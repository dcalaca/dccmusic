import { supabaseAdmin } from './supabase'
import { sendMarketingCampaignEmail } from './dcc-emails'
import { getEmailOptOutUrl, getOptedOutEmailSet, normalizeMarketingEmail } from './email-opt-outs'

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

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
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
    .select('recipient_email, status')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'skipped'])

  if (error) throw error

  return new Set((data || []).map((delivery: any) => normalizeEmail(delivery.recipient_email)).filter(Boolean))
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
  const limit = Math.min(Math.max(Number(options?.limit || 100), 1), 500)
  const { data: campaign, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!campaign) throw new Error('Campanha não encontrada')
  if (!['scheduled', 'sending'].includes(campaign.status)) {
    throw new Error('A campanha precisa estar agendada para enviar')
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
    try {
      const result = await sendMarketingCampaignEmail({
        to: recipient.email,
        name: recipient.name,
        subject: campaign.subject,
        preview: campaign.preview,
        body: campaign.body,
        ctaLabel: campaign.cta_label,
        ctaUrl: campaign.cta_url,
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
        await logDelivery({
          campaignId,
          recipient,
          status: 'sent',
          providerMessageId: result.id || null,
        })
      } else {
        failed += 1
        await logDelivery({
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
      await logDelivery({
        campaignId,
        recipient,
        status: 'failed',
        errorMessage: message,
      })
    }
  }

  const remainingAfterRun = recipients.length - alreadyHandled.size - pendingRecipients.length
  const isRecurring = Boolean(campaign.recurring_enabled && campaign.recurring_day)
  const nextStatus = remainingAfterRun > 0
    ? 'scheduled'
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

  if (isRecurring && remainingAfterRun <= 0) {
    updatePayload.next_run_at = calculateNextRunAt(campaign.recurring_day)
  }

  await supabaseAdmin
    .from('admin_email_campaigns')
    .update(updatePayload)
    .eq('id', campaignId)

  return {
    campaignId,
    totalRecipients: recipients.length,
    attempted: pendingRecipients.length,
    sent,
    failed,
    remaining: Math.max(0, remainingAfterRun),
    errors,
  }
}

export async function processDueEmailCampaigns(options?: { limitPerCampaign?: number }) {
  const now = new Date()
  const currentDay = now.getUTCDate()

  const { data: campaigns, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .or(`scheduled_at.lte.${now.toISOString()},next_run_at.lte.${now.toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) throw error

  const results = []

  for (const campaign of campaigns || []) {
    const recurringDay = Number((campaign as any).recurring_day) || null
    const shouldRunRecurring = Boolean((campaign as any).recurring_enabled && recurringDay === currentDay)
    const shouldRunScheduled = Boolean((campaign as any).scheduled_at && new Date((campaign as any).scheduled_at) <= now)
    const lastRunToday = (campaign as any).last_run_at && todayKey(new Date((campaign as any).last_run_at)) === todayKey(now)

    if (!shouldRunScheduled && !shouldRunRecurring) continue
    if (shouldRunRecurring && lastRunToday) continue

    results.push(await sendEmailCampaign((campaign as any).id, {
      limit: options?.limitPerCampaign || 100,
    }))
  }

  return results
}

export { calculateNextRunAt }
