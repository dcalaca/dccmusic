import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CAMPAIGN_BATCH_SIZE,
  calculateNextRunAt,
  countRecipientLanguages,
  getCampaignRecipients,
  getInactiveComposerRecipients,
  getPendingEmailRecipients,
  getRecipientsForCampaign,
  sendEmailCampaign,
} from '@/lib/admin-email-campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SETUP_ERROR_HINTS = ['admin_email_campaigns', 'admin_email_campaign_deliveries', 'schema cache', 'does not exist']

function isSetupError(error: any) {
  const message = String(error?.message || error || '').toLowerCase()
  return SETUP_ERROR_HINTS.some((hint) => message.includes(hint.toLowerCase()))
}

function cleanText(value: any, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeAudience(value: any) {
  return ['all', 'composers', 'site_users'].includes(value) ? value : 'all'
}

function normalizeStatus(value: any) {
  return ['draft', 'scheduled', 'paused'].includes(value) ? value : 'draft'
}

function normalizeDateTime(value: any, endOfDay = false) {
  if (!value) return null
  const raw = String(value)
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) date.setUTCHours(23, 59, 59, 999)
    else date.setUTCHours(0, 0, 0, 0)
  }
  return date.toISOString()
}

function normalizeCampaignDateBoundary(value: any, endOfDay = false) {
  const raw = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
    return new Date(`${raw}T${time}-03:00`).toISOString()
  }
  return normalizeDateTime(raw, endOfDay)
}

function normalizeRecurringDay(value: any) {
  const day = Number(value)
  if (!Number.isFinite(day) || day < 1 || day > 28) return null
  return Math.floor(day)
}

async function getDeliveryStats(campaignIds: string[]) {
  const stats = new Map<string, { sent: number; failed: number; skipped: number; pending: number; reserved: number }>()
  campaignIds.forEach((id) => stats.set(id, { sent: 0, failed: 0, skipped: 0, pending: 0, reserved: 0 }))
  if (campaignIds.length === 0) return stats

  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('campaign_id, status, error_message')
    .in('campaign_id', campaignIds)
  if (error) throw error

  for (const row of data || []) {
    const item = stats.get((row as any).campaign_id)
    if (!item) continue
    if ((row as any).status === 'sent') item.sent += 1
    else if ((row as any).status === 'failed') item.failed += 1
    else if ((row as any).status === 'pending') item.pending += 1
    else if ((row as any).status === 'skipped' && (row as any).error_message === '__reserved__') item.reserved += 1
    else if ((row as any).status === 'skipped') item.skipped += 1
  }

  return stats
}

async function getClickStats(campaignIds: string[]) {
  const emptyStats = new Map<string, { total: number; human: number; bot: number; unknown: number }>()
  campaignIds.forEach((id) => emptyStats.set(id, { total: 0, human: 0, bot: 0, unknown: 0 }))
  if (campaignIds.length === 0) return emptyStats

  try {
    const { data: links, error: linksError } = await supabaseAdmin
      .from('dccmusic_tracked_links')
      .select('id, notes')
      .eq('created_by', 'admin_email_campaign')
      .limit(5000)
    if (linksError) throw linksError

    const linkCampaignMap = new Map<string, string>()
    for (const link of links || []) {
      try {
        const notes = JSON.parse((link as any).notes || '{}')
        if (!campaignIds.includes(notes.campaignId)) continue
        linkCampaignMap.set((link as any).id, notes.campaignId)
      } catch {}
    }

    const linkIds = Array.from(linkCampaignMap.keys())
    if (linkIds.length === 0) return emptyStats

    const { data: clicks, error: clicksError } = await supabaseAdmin
      .from('dccmusic_link_clicks')
      .select('link_id, click_type')
      .in('link_id', linkIds)
      .limit(10000)
    if (clicksError) throw clicksError

    for (const click of clicks || []) {
      const campaignId = linkCampaignMap.get((click as any).link_id)
      if (!campaignId) continue
      const item = emptyStats.get(campaignId) || { total: 0, human: 0, bot: 0, unknown: 0 }
      item.total += 1
      if ((click as any).click_type === 'HUMAN_CLICK') item.human += 1
      else if ((click as any).click_type === 'BOT_PREVIEW') item.bot += 1
      else item.unknown += 1
      emptyStats.set(campaignId, item)
    }
  } catch (error) {
    console.warn('[ADMIN EMAIL CAMPAIGNS] Não foi possível carregar cliques:', error)
  }

  return emptyStats
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    if (request.nextUrl.searchParams.get('mode') === 'count') {
      const targetMode = request.nextUrl.searchParams.get('targetMode')
      const excludePreviouslySent = request.nextUrl.searchParams.get('excludePreviouslySent') === 'true'
      const targetFrom = normalizeDateTime(request.nextUrl.searchParams.get('from'))
      const targetTo = normalizeDateTime(request.nextUrl.searchParams.get('to'), true)
      const sentFilterFrom = normalizeCampaignDateBoundary(request.nextUrl.searchParams.get('sentFrom'))
      const sentFilterTo = normalizeCampaignDateBoundary(request.nextUrl.searchParams.get('sentTo'), true)

      if (targetMode === 'pending_email' && (!targetFrom || !targetTo || new Date(targetFrom) > new Date(targetTo))) {
        return NextResponse.json({ error: 'Período inválido para e-mails pendentes.' }, { status: 400 })
      }
      if (targetMode === 'inactive' && !targetFrom) {
        return NextResponse.json({ count: 0, languages: { pt: 0, es: 0, en: 0 } })
      }
      if (excludePreviouslySent && (!sentFilterFrom || !sentFilterTo || new Date(sentFilterFrom) > new Date(sentFilterTo))) {
        return NextResponse.json({ error: 'Informe um período válido para verificar os e-mails já enviados.' }, { status: 400 })
      }

      const audience = normalizeAudience(request.nextUrl.searchParams.get('audience'))
      const recipients = await getRecipientsForCampaign({
        id: 'preview',
        name: '',
        subject: '',
        body: '',
        audience,
        status: 'draft',
        target_mode: targetMode === 'pending_email' || targetMode === 'inactive' ? targetMode : 'audience',
        target_from: targetFrom,
        target_to: targetTo,
        exclude_previously_sent: excludePreviouslySent,
        sent_filter_from: sentFilterFrom,
        sent_filter_to: sentFilterTo,
      })
      return NextResponse.json({ count: recipients.length, languages: countRecipientLanguages(recipients) })
    }

    const includeHidden = request.nextUrl.searchParams.get('showHidden') === '1'
    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .eq('is_hidden', includeHidden)
      .order('created_at', { ascending: false })
    if (error) throw error

    const campaigns = data || []
    const campaignIds = campaigns.map((campaign: any) => campaign.id)
    const [stats, clickStats, allRecipients, composerRecipients, siteUserRecipients] = await Promise.all([
      getDeliveryStats(campaignIds),
      getClickStats(campaignIds),
      getCampaignRecipients('all'),
      getCampaignRecipients('composers'),
      getCampaignRecipients('site_users'),
    ])

    const livePendingCounts = new Map<string, number>()
    await Promise.all(
      campaigns.map(async (campaign: any) => {
        if (campaign.frozen_at || !campaign.target_from) return
        if (campaign.target_mode !== 'pending_email' && campaign.target_mode !== 'inactive') return

        const recipients = campaign.target_mode === 'inactive'
          ? await getInactiveComposerRecipients(campaign.target_from)
          : campaign.target_to
            ? await getPendingEmailRecipients(campaign.target_from, campaign.target_to)
            : []
        livePendingCounts.set(campaign.id, recipients.length)
      })
    )

    return NextResponse.json({
      campaigns: campaigns.map((campaign: any) => ({
        ...campaign,
        target_count: livePendingCounts.has(campaign.id)
          ? livePendingCounts.get(campaign.id)
          : campaign.target_count,
        deliveries: stats.get(campaign.id) || { sent: 0, failed: 0, skipped: 0, pending: 0, reserved: 0 },
        clicks: clickStats.get(campaign.id) || { total: 0, human: 0, bot: 0, unknown: 0 },
      })),
      audienceCounts: {
        all: allRecipients.length,
        composers: composerRecipients.length,
        site_users: siteUserRecipients.length,
      },
      audienceLanguageCounts: {
        all: countRecipientLanguages(allRecipients),
        composers: countRecipientLanguages(composerRecipients),
        site_users: countRecipientLanguages(siteUserRecipients),
      },
      setupRequired: false,
    })
  } catch (error: any) {
    if (isSetupError(error)) {
      return NextResponse.json({
        campaigns: [],
        audienceCounts: { all: 0, composers: 0, site_users: 0 },
        audienceLanguageCounts: {
          all: { pt: 0, es: 0, en: 0 },
          composers: { pt: 0, es: 0, en: 0 },
          site_users: { pt: 0, es: 0, en: 0 },
        },
        setupRequired: true,
      })
    }
    console.error('[ADMIN EMAIL CAMPAIGNS] Erro listar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar campanhas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const status = normalizeStatus(body.status)
    const scheduledAt = normalizeDateTime(body.scheduledAt)
    const recurringDay = normalizeRecurringDay(body.recurringDay)
    const recurringEnabled = false
    const targetMode = body.targetMode === 'pending_email' || body.targetMode === 'inactive' ? body.targetMode : 'audience'
    const targetFrom = targetMode === 'pending_email' || targetMode === 'inactive' ? normalizeDateTime(body.targetFrom) : null
    const targetTo = targetMode === 'pending_email' ? normalizeDateTime(body.targetTo, true) : null

    if (targetMode === 'pending_email' && (!targetFrom || !targetTo || new Date(targetFrom) > new Date(targetTo))) {
      return NextResponse.json({ error: 'Informe um período válido para e-mails pendentes.' }, { status: 400 })
    }
    if (targetMode === 'inactive' && !targetFrom) {
      return NextResponse.json({ error: 'Informe há quantos dias o público está sem criar.' }, { status: 400 })
    }

    const excludePreviouslySent = body.excludePreviouslySent === true
    const sentFilterFrom = excludePreviouslySent ? normalizeCampaignDateBoundary(body.sentFilterFrom) : null
    const sentFilterTo = excludePreviouslySent ? normalizeCampaignDateBoundary(body.sentFilterTo, true) : null
    if (excludePreviouslySent && (!sentFilterFrom || !sentFilterTo || new Date(sentFilterFrom) > new Date(sentFilterTo))) {
      return NextResponse.json({ error: 'Informe um período válido para verificar os e-mails já enviados.' }, { status: 400 })
    }

    const payload = {
      name: cleanText(body.name, 140),
      subject: cleanText(body.subject, 180),
      preview: cleanText(body.preview, 220) || null,
      body: cleanText(body.body, 5000),
      cta_label: cleanText(body.ctaLabel, 80) || null,
      cta_url: cleanText(body.ctaUrl, 500) || null,
      audience: targetMode === 'pending_email' || targetMode === 'inactive' ? 'composers' : normalizeAudience(body.audience),
      status,
      scheduled_at: scheduledAt,
      recurring_day: recurringEnabled ? recurringDay : null,
      recurring_enabled: recurringEnabled,
      next_run_at: status === 'scheduled' ? scheduledAt : null,
      target_mode: targetMode,
      target_from: targetFrom,
      target_to: targetTo,
      target_count: 0,
      frozen_at: null,
      exclude_previously_sent: excludePreviouslySent,
      sent_filter_from: sentFilterFrom,
      sent_filter_to: sentFilterTo,
      created_by: (session as any)?.user?.email || null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.name) {
      return NextResponse.json({ error: 'Informe o nome interno da campanha.' }, { status: 400 })
    }
    if (status !== 'draft' && (!payload.subject || !payload.body)) {
      return NextResponse.json({ error: 'Para agendar, informe o assunto e a mensagem da campanha.' }, { status: 400 })
    }
    if (status === 'scheduled' && !scheduledAt) {
      return NextResponse.json({ error: 'Para agendar, informe data e hora.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ campaign: data })
  } catch (error: any) {
    console.error('[ADMIN EMAIL CAMPAIGNS] Erro criar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar campanha' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const id = cleanText(body.id, 80)
    const action = cleanText(body.action, 40)
    if (!id) return NextResponse.json({ error: 'Campanha não informada.' }, { status: 400 })

    if (action === 'send') {
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('admin_email_campaigns')
        .select('subject, body')
        .eq('id', id)
        .single()
      if (campaignError) throw campaignError
      if (!campaign.subject?.trim() || !campaign.body?.trim()) {
        return NextResponse.json({ error: 'Complete o assunto e a mensagem antes de iniciar o envio.' }, { status: 400 })
      }
      const requestedLimit = Number(body.limit || CAMPAIGN_BATCH_SIZE)
      const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : CAMPAIGN_BATCH_SIZE, 1), CAMPAIGN_BATCH_SIZE)
      const result = await sendEmailCampaign(id, { limit })
      return NextResponse.json({ result, autoContinue: result.remaining > 0 })
    }

    if (action === 'pause') {
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({ status: 'paused', next_run_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    if (action === 'cancel') {
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({ status: 'cancelled', next_run_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['scheduled', 'paused'])
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Só é possível cancelar uma campanha agendada ou pausada.' }, { status: 409 })
      return NextResponse.json({ campaign: data })
    }

    if (action === 'save_draft') {
      const name = cleanText(body.name, 140)
      const subject = cleanText(body.subject, 180)
      const content = cleanText(body.body, 5000)
      if (!name) return NextResponse.json({ error: 'Informe o nome interno da campanha.' }, { status: 400 })
      const targetMode = body.targetMode === 'pending_email' || body.targetMode === 'inactive' ? body.targetMode : 'audience'
      const targetFrom = targetMode === 'pending_email' || targetMode === 'inactive' ? normalizeDateTime(body.targetFrom) : null
      const targetTo = targetMode === 'pending_email' ? normalizeDateTime(body.targetTo, true) : null
      if (targetMode === 'pending_email' && (!targetFrom || !targetTo || new Date(targetFrom) > new Date(targetTo))) {
        return NextResponse.json({ error: 'Informe um período válido para e-mails pendentes.' }, { status: 400 })
      }
      if (targetMode === 'inactive' && !targetFrom) {
        return NextResponse.json({ error: 'Informe há quantos dias o público está sem criar.' }, { status: 400 })
      }
      const excludePreviouslySent = body.excludePreviouslySent === true
      const sentFilterFrom = excludePreviouslySent ? normalizeCampaignDateBoundary(body.sentFilterFrom) : null
      const sentFilterTo = excludePreviouslySent ? normalizeCampaignDateBoundary(body.sentFilterTo, true) : null
      if (excludePreviouslySent && (!sentFilterFrom || !sentFilterTo || new Date(sentFilterFrom) > new Date(sentFilterTo))) {
        return NextResponse.json({ error: 'Informe um período válido para verificar os e-mails já enviados.' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({
          name,
          subject,
          preview: cleanText(body.preview, 220) || null,
          body: content,
          cta_label: cleanText(body.ctaLabel, 80) || null,
          cta_url: cleanText(body.ctaUrl, 500) || null,
          audience: targetMode === 'pending_email' || targetMode === 'inactive' ? 'composers' : normalizeAudience(body.audience),
          target_mode: targetMode,
          target_from: targetFrom,
          target_to: targetTo,
          exclude_previously_sent: excludePreviouslySent,
          sent_filter_from: sentFilterFrom,
          sent_filter_to: sentFilterTo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'draft')
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    if (action === 'schedule') {
      const scheduledAt = normalizeDateTime(body.scheduledAt)
      if (!scheduledAt) return NextResponse.json({ error: 'Informe data e hora para agendar.' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: scheduledAt,
          recurring_day: null,
          recurring_enabled: false,
          next_run_at: scheduledAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    if (action === 'hide' || action === 'unhide') {
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({ is_hidden: action === 'hide', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    console.error('[ADMIN EMAIL CAMPAIGNS] Erro atualizar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar campanha' }, { status: 500 })
  }
}
