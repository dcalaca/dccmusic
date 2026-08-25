import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CAMPAIGN_BATCH_SIZE,
  calculateNextRunAt,
  getCampaignRecipients,
  getPendingEmailRecipients,
  sendEmailCampaign,
} from '@/lib/admin-email-campaigns'

export const dynamic = 'force-dynamic'

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

function normalizeRecurringDay(value: any) {
  const day = Number(value)
  if (!Number.isFinite(day) || day < 1 || day > 28) return null
  return Math.floor(day)
}

async function getDeliveryStats(campaignIds: string[]) {
  const stats = new Map<string, { sent: number; failed: number; skipped: number; pending: number }>()
  campaignIds.forEach((id) => stats.set(id, { sent: 0, failed: 0, skipped: 0, pending: 0 }))
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
    else if ((row as any).status === 'skipped' && (row as any).error_message !== '__reserved__') item.skipped += 1
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
      if (targetMode === 'pending_email') {
        const from = normalizeDateTime(request.nextUrl.searchParams.get('from'))
        const to = normalizeDateTime(request.nextUrl.searchParams.get('to'), true)
        if (!from || !to) return NextResponse.json({ count: 0 })
        if (new Date(from) > new Date(to)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
        const recipients = await getPendingEmailRecipients(from, to)
        return NextResponse.json({ count: recipients.length })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
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

    return NextResponse.json({
      campaigns: campaigns.map((campaign: any) => ({
        ...campaign,
        deliveries: stats.get(campaign.id) || { sent: 0, failed: 0, skipped: 0, pending: 0 },
        clicks: clickStats.get(campaign.id) || { total: 0, human: 0, bot: 0, unknown: 0 },
      })),
      audienceCounts: {
        all: allRecipients.length,
        composers: composerRecipients.length,
        site_users: siteUserRecipients.length,
      },
      setupRequired: false,
    })
  } catch (error: any) {
    if (isSetupError(error)) {
      return NextResponse.json({
        campaigns: [],
        audienceCounts: { all: 0, composers: 0, site_users: 0 },
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
    const targetMode = body.targetMode === 'pending_email' ? 'pending_email' : 'audience'
    const targetFrom = targetMode === 'pending_email' ? normalizeDateTime(body.targetFrom) : null
    const targetTo = targetMode === 'pending_email' ? normalizeDateTime(body.targetTo, true) : null

    if (targetMode === 'pending_email' && (!targetFrom || !targetTo || new Date(targetFrom) > new Date(targetTo))) {
      return NextResponse.json({ error: 'Informe um período válido para e-mails pendentes.' }, { status: 400 })
    }

    const payload = {
      name: cleanText(body.name, 140),
      subject: cleanText(body.subject, 180),
      preview: cleanText(body.preview, 220) || null,
      body: cleanText(body.body, 5000),
      cta_label: cleanText(body.ctaLabel, 80) || null,
      cta_url: cleanText(body.ctaUrl, 500) || null,
      audience: targetMode === 'pending_email' ? 'composers' : normalizeAudience(body.audience),
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
      created_by: (session as any)?.user?.email || null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.name || !payload.subject || !payload.body) {
      return NextResponse.json({ error: 'Informe nome, assunto e mensagem da campanha.' }, { status: 400 })
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
      const result = await sendEmailCampaign(id, { limit: CAMPAIGN_BATCH_SIZE })
      return NextResponse.json({ result, autoContinue: false })
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

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    console.error('[ADMIN EMAIL CAMPAIGNS] Erro atualizar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar campanha' }, { status: 500 })
  }
}
