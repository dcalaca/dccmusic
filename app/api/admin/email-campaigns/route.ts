import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateNextRunAt, CAMPAIGN_BATCH_SIZE, CAMPAIGN_MAX_BATCHES_PER_CRON, continueEmailCampaign, getCampaignRecipients } from '@/lib/admin-email-campaigns'

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

function normalizeDateTime(value: any) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeRecurringDay(value: any) {
  const day = Number(value)
  if (!Number.isFinite(day) || day < 1 || day > 28) return null
  return Math.floor(day)
}

async function getDeliveryStats(campaignIds: string[]) {
  if (campaignIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('campaign_id, status')
    .in('campaign_id', campaignIds)

  if (error) throw error

  const stats = new Map<string, { sent: number; failed: number; skipped: number }>()
  campaignIds.forEach((id) => stats.set(id, { sent: 0, failed: 0, skipped: 0 }))

  for (const row of data || []) {
    const item = stats.get((row as any).campaign_id)
    if (!item) continue
    if ((row as any).status === 'sent') item.sent += 1
    if ((row as any).status === 'failed') item.failed += 1
    if ((row as any).status === 'skipped') item.skipped += 1
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
      } catch {
        continue
      }
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
      const clickType = (click as any).click_type
      item.total += 1
      if (clickType === 'HUMAN_CLICK') item.human += 1
      else if (clickType === 'BOT_PREVIEW') item.bot += 1
      else item.unknown += 1
      emptyStats.set(campaignId, item)
    }

    return emptyStats
  } catch (error) {
    console.warn('[ADMIN EMAIL CAMPAIGNS] Não foi possível carregar cliques:', error)
    return emptyStats
  }
}

export async function GET() {
  try {
    await requireAuth()

    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const campaigns = data || []
    const campaignIds = campaigns.map((campaign: any) => campaign.id)
    const [stats, clickStats] = await Promise.all([
      getDeliveryStats(campaignIds),
      getClickStats(campaignIds),
    ])
    const [allRecipients, composerRecipients, siteUserRecipients] = await Promise.all([
      getCampaignRecipients('all'),
      getCampaignRecipients('composers'),
      getCampaignRecipients('site_users'),
    ])

    return NextResponse.json({
      campaigns: campaigns.map((campaign: any) => ({
        ...campaign,
        deliveries: stats.get(campaign.id) || { sent: 0, failed: 0, skipped: 0 },
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
        sqlFile: 'SQL-EMAIL-CAMPANHAS-ADMIN.sql',
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
    const recurringDay = normalizeRecurringDay(body.recurringDay)
    const recurringEnabled = Boolean(body.recurringEnabled && recurringDay)
    const scheduledAt = normalizeDateTime(body.scheduledAt)
    const status = normalizeStatus(body.status)

    const payload = {
      name: cleanText(body.name, 140),
      subject: cleanText(body.subject, 180),
      preview: cleanText(body.preview, 220) || null,
      body: cleanText(body.body, 5000),
      cta_label: cleanText(body.ctaLabel, 80) || null,
      cta_url: cleanText(body.ctaUrl, 500) || null,
      audience: normalizeAudience(body.audience),
      status,
      scheduled_at: scheduledAt,
      recurring_day: recurringDay,
      recurring_enabled: recurringEnabled,
      next_run_at: recurringEnabled ? calculateNextRunAt(recurringDay) : scheduledAt,
      created_by: (session as any)?.user?.email || null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.name || !payload.subject || !payload.body) {
      return NextResponse.json({ error: 'Informe nome, assunto e mensagem da campanha.' }, { status: 400 })
    }

    if (status === 'scheduled' && !scheduledAt && !recurringEnabled) {
      return NextResponse.json({ error: 'Para agendar, informe data/hora ou recorrência mensal.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ campaign: data })
  } catch (error: any) {
    if (isSetupError(error)) {
      return NextResponse.json({
        error: 'A tabela de campanhas ainda não existe. Execute SQL-EMAIL-CAMPANHAS-ADMIN.sql no Supabase.',
        setupRequired: true,
      }, { status: 400 })
    }

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
      const { error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({
          status: 'sending',
          scheduled_at: new Date().toISOString(),
          next_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      const result = await continueEmailCampaign(id, {
        limitPerCampaign: CAMPAIGN_BATCH_SIZE,
        maxBatches: CAMPAIGN_MAX_BATCHES_PER_CRON,
      })

      return NextResponse.json({
        result,
        autoContinue: result.remaining > 0,
      })
    }

    if (action === 'pause') {
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    if (action === 'schedule') {
      const recurringDay = normalizeRecurringDay(body.recurringDay)
      const recurringEnabled = Boolean(body.recurringEnabled && recurringDay)
      const scheduledAt = normalizeDateTime(body.scheduledAt)

      if (!scheduledAt && !recurringEnabled) {
        return NextResponse.json({ error: 'Informe data/hora ou recorrência para agendar.' }, { status: 400 })
      }

      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: scheduledAt,
          recurring_day: recurringDay,
          recurring_enabled: recurringEnabled,
          next_run_at: recurringEnabled ? calculateNextRunAt(recurringDay) : scheduledAt,
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
