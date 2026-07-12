import { supabaseAdmin } from './supabase'
import { sendMarketingCampaignEmail } from './dcc-emails'
import { getEmailOptOutUrl, getOptedOutEmailSet, normalizeMarketingEmail } from './email-opt-outs'
import { createCampaignButtonUrl } from './email-magic-login'
import { getBaseUrl } from './link-utils'

export type EmailCampaign = {
  id: string
  name: string
  subject: string
  preview?: string | null
  body: string
  cta_label?: string | null
  cta_url?: string | null
  audience: 'all' | 'composers' | 'site_users'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  scheduled_at?: string | null
  recurring_day?: number | null
  recurring_enabled?: boolean
  last_run_at?: string | null
  next_run_at?: string | null
  sent_count?: number
  failed_count?: number
}

type Recipient = {
  type: 'composer' | 'site_user'
  id: string
  name: string
  email: string
}

function normalizeEmail(value: any) {
  return normalizeMarketingEmail(value)
}

const CAMPAIGN_BATCH_SIZE = 40
const CAMPAIGN_MAX_BATCHES_PER_CRON = 4
const CAMPAIGN_LOCK_MINUTES = 8
const DELIVERY_CLAIM_TAG = '__reserved__'

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function scheduleCampaignContinuation(campaignId: string) {
  if (typeof fetch !== 'function') return

  const siteUrl = getBaseUrl().replace(/\/$/, '')
  const secret = process.env.CRON_SECRET || ''
  const url = `${siteUrl}/api/cron/email-campaigns?campaignId=${encodeURIComponent(campaignId)}`

  void fetch(url, {
    method: 'GET',
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    cache: 'no-store',
  }).catch((error) => {
    console.warn('[EMAIL CAMPAIGNS] Continuação automática falhou:', error)
  })
}

async function tryLockCampaign(campaignId: string) {
  const staleBefore = new Date(Date.now() - CAMPAIGN_LOCK_MINUTES * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ last_run_at: now, updated_at: now })
    .eq('id', campaignId)
    .in('status', ['scheduled', 'sending'])
    .or(`last_run_at.is.null,last_run_at.lt.${staleBefore}`)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.id)
}

async function refreshCampaignLock(campaignId: string) {
  await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .in('status', ['scheduled', 'sending'])
}

async function tryReserveRecipient(campaignId: string, recipient: Recipient) {
  const { error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .insert({
      campaign_id: campaignId,
      recipient_type: recipient.type,
      recipient_id: recipient.id,
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      status: 'skipped',
      error_message: DELIVERY_CLAIM_TAG,
    })

  if (error) {
    if (String(error.message || '').toLowerCase().includes('duplicate')) return false
    throw error
  }

  return true
}

async function finalizeDelivery(input: {
  campaignId: string
  recipient: Recipient
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string | null
  errorMessage?: string | null
}) {
  const { error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .update({
      status: input.status,
      provider_message_id: input.providerMessageId || null,
      error_message: input.errorMessage || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('campaign_id', input.campaignId)
    .eq('recipient_email', input.recipient.email)
    .eq('error_message', DELIVERY_CLAIM_TAG)

  if (error) throw error
}

function calculateNextRunAt(recurringDay?: number | null, fromDate = new Date()) {
  if (!recurringDay) return null

  const next = new Date(fromDate)
  next.setUTCHours(12, 0, 0, 0)
  next.setUTCDate(recurringDay)

  if (next <= fromDate) {
    next.setUTCMonth(next.getUTCMonth() + 1)
    next.setUTCDate(recurringDay)
  }

  return next.toISOString()
}

export async function getCampaignRecipients(audience: EmailCampaign['audience']) {
  const recipients = new Map<string, Recipient>()

  if (audience === 'all' || audience === 'composers') {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .not('email', 'is', null)

    if (error) throw error

    for (const composer of data || []) {
      const email = normalizeEmail((composer as any).email)
      if (!email || recipients.has(email)) continue
      recipients.set(email, {
        type: 'composer',
        id: (composer as any).id,
        name: (composer as any).name || 'Compositor',
        email,
      })
    }
  }

  if (audience === 'all' || audience === 'site_users') {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .select('id, name, first_name, email, is_active')
      .not('email', 'is', null)

    if (error) throw error

    for (const user of data || []) {
      if ((user as any).is_active === false) continue
      const email = normalizeEmail((user as any).email)
      if (!email || recipients.has(email)) continue
      recipients.set(email, {
        type: 'site_user',
        id: (user as any).id,
        name: (user as any).first_name || (user as any).name || 'Usuário',
        email,
      })
    }
  }

  const optedOutEmails = await getOptedOutEmailSet()
  return Array.from(recipients.values()).filter((recipient) => !optedOutEmails.has(recipient.email))
}

async function getAlreadyHandledEmails(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('recipient_email')
    .eq('campaign_id', campaignId)

  if (error) throw error

  return new Set((data || []).map((delivery: any) => normalizeEmail(delivery.recipient_email)).filter(Boolean))
}

async function getHandledEmailCount(campaignId: string) {
  const { count, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('recipient_email', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  if (error) throw error
  return Number(count || 0)
}

async function logDelivery(input: {
  campaignId: string
  recipient: Recipient
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string | null
  errorMessage?: string | null
}) {
  const { error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .insert({
      campaign_id: input.campaignId,
      recipient_type: input.recipient.type,
      recipient_id: input.recipient.id,
      recipient_email: input.recipient.email,
      recipient_name: input.recipient.name,
      status: input.status,
      provider_message_id: input.providerMessageId || null,
      error_message: input.errorMessage || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    })

  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
    throw error
  }
}

export async function sendEmailCampaign(campaignId: string, options?: { limit?: number }) {
  const limit = Math.min(Math.max(Number(options?.limit || CAMPAIGN_BATCH_SIZE), 1), 500)
  const { data: campaign, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!campaign) throw new Error('Campanha não encontrada')
  if (!['scheduled', 'sending'].includes(campaign.status)) {
    throw new Error('A campanha precisa estar agendada ou em envio para continuar')
  }

  await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  const recipients = await getCampaignRecipients(campaign.audience)
  const alreadyHandled = await getAlreadyHandledEmails(campaignId)
  const pendingRecipients = recipients
    .filter((recipient) => !alreadyHandled.has(recipient.email))
    .slice(0, limit)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const recipient of pendingRecipients) {
    const reserved = await tryReserveRecipient(campaignId, recipient)
    if (!reserved) continue

    try {
      const trackedCtaUrl = campaign.cta_label && campaign.cta_url
        ? await createCampaignButtonUrl({
          campaignId,
          campaignName: campaign.name,
          recipientType: recipient.type,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          ctaLabel: campaign.cta_label,
          ctaUrl: campaign.cta_url,
        })
        : null

      const result = await sendMarketingCampaignEmail({
        to: recipient.email,
        name: recipient.name,
        subject: campaign.subject,
        preview: campaign.preview,
        body: campaign.body,
        ctaLabel: campaign.cta_label,
        ctaUrl: trackedCtaUrl || campaign.cta_url,
        unsubscribeUrl: getEmailOptOutUrl({
          email: recipient.email,
          recipientType: recipient.type,
          recipientId: recipient.id,
          campaignId,
        }),
        campaignId,
        recipientType: recipient.type,
        recipientId: recipient.id,
      })

      if (result.sent) {
        sent += 1
        await finalizeDelivery({
          campaignId,
          recipient,
          status: 'sent',
          providerMessageId: result.id || null,
        })
      } else {
        failed += 1
        await finalizeDelivery({
          campaignId,
          recipient,
          status: 'skipped',
          errorMessage: result.reason || 'Envio ignorado',
        })
      }
    } catch (error: any) {
      failed += 1
      const message = error?.message || 'Erro ao enviar'
      errors.push(`${recipient.email}: ${message}`)
      await finalizeDelivery({
        campaignId,
        recipient,
        status: 'failed',
        errorMessage: message,
      })
    }
  }

  const handledAfterRun = await getHandledEmailCount(campaignId)
  const remainingAfterRun = Math.max(0, recipients.length - handledAfterRun)
  const isRecurring = Boolean(campaign.recurring_enabled && campaign.recurring_day)
  const nextStatus = remainingAfterRun > 0
    ? 'sending'
    : isRecurring
      ? 'scheduled'
      : 'sent'

  const updatePayload: any = {
    status: nextStatus,
    sent_count: Number(campaign.sent_count || 0) + sent,
    failed_count: Number(campaign.failed_count || 0) + failed,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (remainingAfterRun > 0) {
    updatePayload.next_run_at = new Date().toISOString()
  } else if (isRecurring) {
    updatePayload.next_run_at = calculateNextRunAt(campaign.recurring_day)
  } else {
    updatePayload.next_run_at = null
  }

  await supabaseAdmin
    .from('admin_email_campaigns')
    .update(updatePayload)
    .eq('id', campaignId)

  const result = {
    campaignId,
    totalRecipients: recipients.length,
    attempted: pendingRecipients.length,
    sent,
    failed,
    remaining: Math.max(0, remainingAfterRun),
    errors,
  }

  return result
}

export async function continueEmailCampaign(
  campaignId: string,
  options?: { limitPerCampaign?: number; maxBatches?: number },
) {
  const locked = await tryLockCampaign(campaignId)
  if (!locked) {
    return {
      campaignId,
      skipped: true,
      reason: 'locked',
      totalRecipients: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
      errors: [] as string[],
      batches: 0,
    }
  }

  const batchLimit = Math.min(Math.max(Number(options?.limitPerCampaign || CAMPAIGN_BATCH_SIZE), 1), 500)
  const maxBatches = Math.min(Math.max(Number(options?.maxBatches || CAMPAIGN_MAX_BATCHES_PER_CRON), 1), 20)

  let batches = 0
  let lastResult = await sendEmailCampaign(campaignId, { limit: batchLimit })

  while (lastResult.remaining > 0 && batches < maxBatches - 1) {
    batches += 1
    await refreshCampaignLock(campaignId)
    lastResult = await sendEmailCampaign(campaignId, { limit: batchLimit })
  }

  if (lastResult.remaining > 0) {
    scheduleCampaignContinuation(campaignId)
  }

  return {
    ...lastResult,
    batches: batches + 1,
    autoContinue: lastResult.remaining > 0,
  }
}

function shouldProcessCampaign(campaign: EmailCampaign, now = new Date()) {
  const recurringDay = Number(campaign.recurring_day) || null
  const lastRunToday = campaign.last_run_at && todayKey(new Date(campaign.last_run_at)) === todayKey(now)
  const nextRunAt = campaign.next_run_at ? new Date(campaign.next_run_at) : null
  const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at) : null
  const isDueByNextRun = Boolean(nextRunAt && nextRunAt <= now)
  const isDueBySchedule = Boolean(scheduledAt && scheduledAt <= now)
  const shouldRunSending = campaign.status === 'sending'
  const shouldRunRecurring = Boolean(
    campaign.status === 'scheduled' &&
    campaign.recurring_enabled &&
    recurringDay === now.getUTCDate() &&
    (isDueByNextRun || isDueBySchedule)
  )
  const shouldRunScheduled = campaign.status === 'scheduled' && (isDueBySchedule || isDueByNextRun)

  if (shouldRunSending) return true
  if (shouldRunRecurring && !lastRunToday) return true
  if (shouldRunScheduled && !campaign.recurring_enabled) return true
  return false
}

export async function processDueEmailCampaigns(options?: {
  limitPerCampaign?: number
  maxBatchesPerCampaign?: number
  campaignId?: string
}) {
  const now = new Date()
  const batchLimit = Math.min(Math.max(Number(options?.limitPerCampaign || CAMPAIGN_BATCH_SIZE), 1), 500)
  const maxBatches = Math.min(Math.max(Number(options?.maxBatchesPerCampaign || CAMPAIGN_MAX_BATCHES_PER_CRON), 1), 20)

  if (options?.campaignId) {
    const result = await continueEmailCampaign(options.campaignId, {
      limitPerCampaign: batchLimit,
      maxBatches,
    })
    return result.skipped ? [] : [result]
  }

  const [{ data: sendingCampaigns, error: sendingError }, { data: scheduledCampaigns, error: scheduledError }] = await Promise.all([
    supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .eq('status', 'sending')
      .order('next_run_at', { ascending: true, nullsFirst: true })
      .limit(5),
    supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .or(`scheduled_at.lte.${now.toISOString()},next_run_at.lte.${now.toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(10),
  ])

  if (sendingError) throw sendingError
  if (scheduledError) throw scheduledError

  const campaigns = [...(sendingCampaigns || []), ...(scheduledCampaigns || [])]
  const seen = new Set<string>()
  const results = []

  for (const campaign of campaigns) {
    if (seen.has(campaign.id)) continue
    seen.add(campaign.id)
    if (!shouldProcessCampaign(campaign as EmailCampaign, now)) continue

    const result = await continueEmailCampaign((campaign as any).id, {
      limitPerCampaign: batchLimit,
      maxBatches,
    })

    if (!result.skipped) {
      results.push(result)
    }
  }

  return results
}

export { calculateNextRunAt, CAMPAIGN_BATCH_SIZE, CAMPAIGN_MAX_BATCHES_PER_CRON }
