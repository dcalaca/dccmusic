import { supabaseAdmin } from './supabase'
import { getEmailOptOutUrl, getOptedOutEmailSet, normalizeMarketingEmail } from './email-opt-outs'
import { createCampaignButtonUrl } from './email-magic-login'

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
  target_mode?: 'audience' | 'pending_email'
  target_from?: string | null
  target_to?: string | null
  target_count?: number
  frozen_at?: string | null
}

type Recipient = {
  type: 'composer' | 'site_user'
  id: string
  name: string
  email: string
}

type DeliveryRow = {
  id: string
  recipient_type: 'composer' | 'site_user'
  recipient_id: string | null
  recipient_email: string
  recipient_name: string | null
  status: 'pending' | 'sent' | 'failed' | 'skipped'
}

export const CAMPAIGN_BATCH_SIZE = 40
export const CAMPAIGN_MAX_BATCHES_PER_CRON = 1
const DELIVERY_CLAIM_TAG = '__reserved__'

function normalizeEmail(value: unknown) {
  return normalizeMarketingEmail(value)
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function parseSender(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, '') || undefined, email: match[2].trim() }
  }
  return { email: raw }
}

async function sendCampaignViaBrevo(input: {
  to: string
  name: string
  subject: string
  preview?: string | null
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  unsubscribeUrl?: string | null
}) {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim()
  const sender = parseSender(process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM_EMAIL)
  const replyTo = parseSender(process.env.BREVO_REPLY_TO_EMAIL || process.env.SMTP_REPLY_TO_EMAIL)

  if (!apiKey || !sender?.email) throw new Error('Brevo não configurado para campanhas')

  const bodyStartsWithGreeting = /^\s*ol[áa][,!\s]/i.test(input.body)
  const greeting = bodyStartsWithGreeting ? '' : `<p>Olá, ${escapeHtml(input.name || 'Compositor')}.</p>`
  const cta = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:22px 0;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 18px;">${escapeHtml(input.ctaLabel)}</a></p>`
    : ''
  const unsubscribe = input.unsubscribeUrl
    ? `<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#c4b5fd;text-decoration:underline;">Não quero mais receber estes e-mails</a>`
    : ''

  const htmlContent = `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(input.preview || input.subject)}</div>
    <div style="background:#030712;color:#f9fafb;font-family:Arial,Helvetica,sans-serif;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#050816;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
        <div style="padding:22px 24px;border-bottom:1px solid #1f2937;background:linear-gradient(135deg,#050816,#1e0b42);">
          <p style="margin:0 0 8px;color:#c084fc;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">DCC Music</p>
          <h1 style="margin:0;color:#fff;font-size:24px;line-height:1.2;">${escapeHtml(input.subject)}</h1>
        </div>
        <div style="padding:24px;color:#e5e7eb;font-size:15px;line-height:1.65;">
          ${greeting}
          <p>${nl2br(input.body)}</p>
          ${cta}
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Você recebeu este e-mail porque tem cadastro na DCC Music.${unsubscribe}</p>
        </div>
      </div>
    </div>`

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.to }],
      replyTo: replyTo || undefined,
      subject: input.subject,
      htmlContent,
      tags: ['admin_email_campaign'],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Erro ao enviar e-mail pelo Brevo')
  return { sent: true, id: payload?.messageId || null }
}

export function calculateNextRunAt(recurringDay?: number | null, fromDate = new Date()) {
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
        id: String((composer as any).id),
        name: String((composer as any).name || 'Compositor'),
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
        id: String((user as any).id),
        name: String((user as any).first_name || (user as any).name || 'Usuário'),
        email,
      })
    }
  }

  const optedOutEmails = await getOptedOutEmailSet()
  return Array.from(recipients.values()).filter((recipient) => !optedOutEmails.has(recipient.email))
}

export async function getPendingEmailRecipients(from: string, to: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, email_verified, created_at')
    .not('email', 'is', null)
    .eq('email_verified', false)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
  if (error) throw error

  const optedOut = await getOptedOutEmailSet()
  const seen = new Set<string>()
  const recipients: Recipient[] = []

  for (const row of data || []) {
    const email = normalizeEmail((row as any).email)
    if (!email || seen.has(email) || optedOut.has(email)) continue
    seen.add(email)
    recipients.push({
      type: 'composer',
      id: String((row as any).id),
      name: String((row as any).name || 'Compositor'),
      email,
    })
  }

  return recipients
}

export async function getRecipientsForCampaign(campaign: EmailCampaign) {
  if (campaign.target_mode === 'pending_email') {
    if (!campaign.target_from || !campaign.target_to) return []
    return getPendingEmailRecipients(campaign.target_from, campaign.target_to)
  }
  return getCampaignRecipients(campaign.audience)
}

async function getCampaign(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Campanha não encontrada')
  return data as EmailCampaign
}

async function queueExists(campaignId: string) {
  const { count, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  if (error) throw error
  return Number(count || 0)
}

async function freezeCampaignAudience(campaign: EmailCampaign) {
  const existingCount = await queueExists(campaign.id)
  if (existingCount > 0) return Math.max(Number(campaign.target_count || 0), existingCount)

  const recipients = await getRecipientsForCampaign(campaign)
  for (let index = 0; index < recipients.length; index += 400) {
    const chunk = recipients.slice(index, index + 400).map((recipient) => ({
      campaign_id: campaign.id,
      recipient_type: recipient.type,
      recipient_id: recipient.id,
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      status: 'pending',
      provider_message_id: null,
      error_message: null,
      sent_at: null,
    }))
    if (chunk.length === 0) continue
    const { error } = await supabaseAdmin.from('admin_email_campaign_deliveries').insert(chunk)
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error
  }

  const frozenAt = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ target_count: recipients.length, frozen_at: frozenAt, updated_at: frozenAt })
    .eq('id', campaign.id)
  if (updateError) throw updateError

  return recipients.length
}

async function claimDelivery(row: DeliveryRow) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .update({ status: 'skipped', error_message: DELIVERY_CLAIM_TAG })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

async function finalizeDelivery(row: DeliveryRow, input: {
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
    .eq('id', row.id)
    .eq('error_message', DELIVERY_CLAIM_TAG)
  if (error) throw error
}

async function countDeliveries(campaignId: string, status?: string) {
  let query = supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  if (status) query = query.eq('status', status)
  const { count, error } = await query
  if (error) throw error
  return Number(count || 0)
}

export async function sendEmailCampaign(campaignId: string, options?: { limit?: number }) {
  const limit = Math.min(Math.max(Number(options?.limit || CAMPAIGN_BATCH_SIZE), 1), CAMPAIGN_BATCH_SIZE)
  const campaign = await getCampaign(campaignId)

  if (!['draft', 'scheduled', 'sending', 'paused'].includes(campaign.status)) {
    throw new Error('Esta campanha já foi concluída')
  }

  const totalRecipients = await freezeCampaignAudience(campaign)
  if (totalRecipients === 0) {
    await supabaseAdmin
      .from('admin_email_campaigns')
      .update({ status: 'sent', target_count: 0, next_run_at: null, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    return { campaignId, totalRecipients: 0, attempted: 0, sent: 0, failed: 0, remaining: 0, errors: [] as string[] }
  }

  const { data: pendingRows, error: pendingError } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('id, recipient_type, recipient_id, recipient_email, recipient_name, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (pendingError) throw pendingError

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const row of (pendingRows || []) as DeliveryRow[]) {
    const claimed = await claimDelivery(row)
    if (!claimed) continue

    try {
      const trackedCtaUrl = campaign.cta_label && campaign.cta_url && row.recipient_id
        ? await createCampaignButtonUrl({
            campaignId,
            campaignName: campaign.name,
            recipientType: row.recipient_type,
            recipientId: row.recipient_id,
            recipientEmail: row.recipient_email,
            recipientName: row.recipient_name || undefined,
            ctaLabel: campaign.cta_label,
            ctaUrl: campaign.cta_url,
          })
        : null

      const result = await sendCampaignViaBrevo({
        to: row.recipient_email,
        name: row.recipient_name || (row.recipient_type === 'composer' ? 'Compositor' : 'Usuário'),
        subject: campaign.subject,
        preview: campaign.preview,
        body: campaign.body,
        ctaLabel: campaign.cta_label,
        ctaUrl: trackedCtaUrl || campaign.cta_url,
        unsubscribeUrl: getEmailOptOutUrl({
          email: row.recipient_email,
          recipientType: row.recipient_type,
          recipientId: row.recipient_id,
          campaignId,
        }),
      })

      sent += 1
      await finalizeDelivery(row, { status: 'sent', providerMessageId: result.id })
    } catch (error: any) {
      failed += 1
      const message = error?.message || 'Erro ao enviar'
      errors.push(`${row.recipient_email}: ${message}`)
      await finalizeDelivery(row, { status: 'failed', errorMessage: message })
    }
  }

  const remaining = await countDeliveries(campaignId, 'pending')
  const sentTotal = await countDeliveries(campaignId, 'sent')
  const failedTotal = await countDeliveries(campaignId, 'failed')
  const nextStatus = remaining > 0 ? 'paused' : 'sent'
  const now = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({
      status: nextStatus,
      sent_count: sentTotal,
      failed_count: failedTotal,
      last_run_at: now,
      next_run_at: null,
      target_count: Math.max(totalRecipients, sentTotal + failedTotal + remaining),
      updated_at: now,
    })
    .eq('id', campaignId)
  if (updateError) throw updateError

  return {
    campaignId,
    totalRecipients: Math.max(totalRecipients, sentTotal + failedTotal + remaining),
    attempted: (pendingRows || []).length,
    sent,
    failed,
    remaining,
    errors,
  }
}

export async function continueEmailCampaign(campaignId: string, options?: { limitPerCampaign?: number; maxBatches?: number }) {
  const result = await sendEmailCampaign(campaignId, { limit: options?.limitPerCampaign || CAMPAIGN_BATCH_SIZE })
  return { ...result, batches: 1, autoContinue: false }
}

function shouldProcessCampaign(campaign: EmailCampaign, now = new Date()) {
  const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at) : null
  return campaign.status === 'scheduled' && Boolean(scheduledAt && scheduledAt <= now)
}

export async function processDueEmailCampaigns(options?: {
  limitPerCampaign?: number
  maxBatchesPerCampaign?: number
  campaignId?: string
}) {
  if (options?.campaignId) {
    const campaign = await getCampaign(options.campaignId)
    if (!shouldProcessCampaign(campaign) && campaign.status !== 'sending') return []
    return [await continueEmailCampaign(options.campaignId, { limitPerCampaign: options?.limitPerCampaign })]
  }

  const now = new Date()
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)
  if (error) throw error

  const results = []
  for (const campaign of data || []) {
    if (!shouldProcessCampaign(campaign as EmailCampaign, now)) continue
    results.push(await continueEmailCampaign((campaign as any).id, { limitPerCampaign: options?.limitPerCampaign }))
  }
  return results
}
