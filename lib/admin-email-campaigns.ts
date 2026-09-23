import { supabaseAdmin } from './supabase'
import { getEmailOptOutUrl, getOptedOutEmailSet, normalizeMarketingEmail } from './email-opt-outs'
import { createCampaignButtonUrl } from './email-magic-login'
import { buildDccEmailHtml, dccEmailButton } from './dcc-email-template'

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
  translations?: {
    es?: { subject?: string; preview?: string | null; body?: string; ctaLabel?: string | null }
    en?: { subject?: string; preview?: string | null; body?: string; ctaLabel?: string | null }
  } | null
}

export type MarketingLanguage = 'pt' | 'es' | 'en'

type Recipient = {
  type: 'composer' | 'site_user'
  id: string
  name: string
  email: string
  country: string | null
  language: MarketingLanguage
}

type DeliveryRow = {
  id: string
  recipient_type: 'composer' | 'site_user'
  recipient_id: string | null
  recipient_email: string
  recipient_name: string | null
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  recipient_country?: string | null
  recipient_language?: MarketingLanguage | null
  claimed_at?: string | null
}

export const CAMPAIGN_BATCH_SIZE = 40
export const CAMPAIGN_MAX_BATCHES_PER_CRON = 1
const DELIVERY_CLAIM_TAG = '__reserved__'
const SUPABASE_PAGE_SIZE = 1000

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
) {
  const rows: T[] = []
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < SUPABASE_PAGE_SIZE) break
  }
  return rows
}

export function marketingLanguageForCountry(country?: string | null): MarketingLanguage {
  const code = String(country || '').trim().toUpperCase()
  if (['ES', 'MX', 'CO', 'PY', 'CL', 'AR', 'UY', 'PE', 'EC', 'VE', 'BO'].includes(code)) return 'es'
  if (['US', 'GB', 'UK', 'IE', 'CA', 'AU', 'NZ'].includes(code)) return 'en'
  return 'pt'
}

export function countRecipientLanguages(recipients: Array<{ language?: MarketingLanguage | null }>) {
  const counts = { pt: 0, es: 0, en: 0 }
  for (const recipient of recipients) {
    const language = recipient.language === 'es' || recipient.language === 'en' ? recipient.language : 'pt'
    counts[language] += 1
  }
  return counts
}

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

async function sendCampaignViaResend(input: {
  to: string
  name: string
  language: MarketingLanguage
  subject: string
  preview?: string | null
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  unsubscribeUrl?: string | null
  idempotencyKey: string
}) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const sender = parseSender('DCC Music <suporte@email.dccmusic.online>')
  const replyTo = parseSender(
    process.env.RESEND_REPLY_TO_EMAIL ||
    process.env.BREVO_REPLY_TO_EMAIL ||
    process.env.SMTP_REPLY_TO_EMAIL ||
    'suporte@dccmusic.online'
  )

  if (!apiKey || !sender?.email) throw new Error('Resend não configurado para campanhas')

  const localized = input.language === 'es'
    ? {
        greeting: 'Hola',
        defaultName: 'Compositor',
        unsubscribe: 'No quiero recibir más estos correos',
        footer: 'Recibiste este correo porque tienes una cuenta en DCC Music.',
        greetingPattern: /^\s*hola[,!\s]/i,
      }
    : input.language === 'en'
      ? {
          greeting: 'Hello',
          defaultName: 'Creator',
          unsubscribe: 'I no longer want to receive these emails',
          footer: 'You received this email because you have an account with DCC Music.',
          greetingPattern: /^\s*(hello|hi)[,!\s]/i,
        }
      : {
          greeting: 'Olá',
          defaultName: 'Compositor',
          unsubscribe: 'Não quero mais receber estes e-mails',
          footer: 'Você recebeu este e-mail porque tem cadastro na DCC Music.',
          greetingPattern: /^\s*ol[áa][,!\s]/i,
        }

  const bodyStartsWithGreeting = localized.greetingPattern.test(input.body)
  const greeting = bodyStartsWithGreeting
    ? ''
    : `<p>${localized.greeting}, ${escapeHtml(input.name || localized.defaultName)}.</p>`
  const cta = input.ctaLabel && input.ctaUrl
    ? dccEmailButton(input.ctaLabel, input.ctaUrl)
    : ''
  const unsubscribe = input.unsubscribeUrl
    ? `<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#7C16F8;text-decoration:underline;">${localized.unsubscribe}</a>`
    : ''

  const htmlContent = buildDccEmailHtml({
    subject: input.subject,
    title: input.subject,
    preview: input.preview,
    contentHtml: `
      ${greeting}
      <p>${nl2br(input.body)}</p>
      ${cta}
      <p style="margin-top:24px;font-size:12px;color:#777080;">${localized.footer}${unsubscribe}</p>
    `,
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
      to: [input.to],
      reply_to: replyTo?.email || undefined,
      subject: input.subject,
      html: htmlContent,
      tags: [{ name: 'category', value: 'admin_email_campaign' }],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Erro ao enviar e-mail pelo Resend')
  return { sent: true, id: payload?.id || null }
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
  const composerCountries = new Map<string, string | null>()

  if (audience === 'all' || audience === 'composers') {
    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('dccmusic_composers')
        .select('id, name, email, country')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)
    )

    for (const composer of data) {
      const email = normalizeEmail(composer.email)
      if (!email) continue
      const country = String(composer.country || '').trim().toUpperCase() || null
      composerCountries.set(email, country)
      if (recipients.has(email)) continue
      recipients.set(email, {
        type: 'composer',
        id: String(composer.id),
        name: String(composer.name || 'Compositor'),
        email,
        country,
        language: marketingLanguageForCountry(country),
      })
    }
  }

  if (audience === 'all' || audience === 'site_users') {
    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('dccmusic_site_users')
        .select('id, name, first_name, email, is_active')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)
    )

    if (audience === 'site_users' && composerCountries.size === 0) {
      const composerData = await fetchAllRows<any>((from, to) =>
        supabaseAdmin
          .from('dccmusic_composers')
          .select('email, country')
          .not('email', 'is', null)
          .order('id', { ascending: true })
          .range(from, to)
      )
      for (const composer of composerData) {
        const email = normalizeEmail(composer.email)
        if (!email) continue
        composerCountries.set(email, String(composer.country || '').trim().toUpperCase() || null)
      }
    }

    for (const user of data) {
      if (user.is_active === false) continue
      const email = normalizeEmail(user.email)
      if (!email || recipients.has(email)) continue
      const country = composerCountries.get(email) || null
      recipients.set(email, {
        type: 'site_user',
        id: String(user.id),
        name: String(user.first_name || user.name || 'Usuário'),
        email,
        country,
        language: marketingLanguageForCountry(country),
      })
    }
  }

  const optedOutEmails = await getOptedOutEmailSet()
  return Array.from(recipients.values()).filter((recipient) => !optedOutEmails.has(recipient.email))
}

export async function getPendingEmailRecipients(from: string, to: string) {
  const data = await fetchAllRows<any>((pageFrom, pageTo) =>
    supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email, email_verified, created_at, country')
      .not('email', 'is', null)
      .eq('email_verified', false)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(pageFrom, pageTo)
  )

  const optedOut = await getOptedOutEmailSet()
  const seen = new Set<string>()
  const recipients: Recipient[] = []

  for (const row of data) {
    const email = normalizeEmail(row.email)
    if (!email || seen.has(email) || optedOut.has(email)) continue
    seen.add(email)
    const country = String(row.country || '').trim().toUpperCase() || null
    recipients.push({
      type: 'composer',
      id: String(row.id),
      name: String(row.name || 'Compositor'),
      email,
      country,
      language: marketingLanguageForCountry(country),
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

type CampaignTranslationContent = {
  subject: string
  preview: string | null
  body: string
  ctaLabel: string | null
}

function getCampaignContent(campaign: EmailCampaign, language: MarketingLanguage): CampaignTranslationContent {
  if (language === 'pt') {
    return {
      subject: campaign.subject,
      preview: campaign.preview || null,
      body: campaign.body,
      ctaLabel: campaign.cta_label || null,
    }
  }

  const translated = campaign.translations?.[language]
  if (!translated?.subject || !translated?.body) {
    throw new Error(`Tradução ${language === 'es' ? 'em espanhol' : 'em inglês'} indisponível para esta campanha.`)
  }

  return {
    subject: String(translated.subject),
    preview: translated.preview ? String(translated.preview) : null,
    body: String(translated.body),
    ctaLabel: translated.ctaLabel ? String(translated.ctaLabel) : null,
  }
}

async function translateCampaignContent(campaign: EmailCampaign) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('Tradução automática de campanhas não está configurada no servidor.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Translate a customer-facing DCC Music marketing email from Brazilian Portuguese.',
            'Return ONLY valid JSON with keys "es" and "en".',
            'Each key must contain subject, preview, body and ctaLabel.',
            'Use natural neutral Spanish for es and natural English for en.',
            'Preserve DCC Music, coupon codes, product names, numbers, line breaks and meaning.',
            'Do not add claims, discounts, promises, emojis or information not present in the source.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            subject: campaign.subject,
            preview: campaign.preview || '',
            body: campaign.body,
            ctaLabel: campaign.cta_label || '',
          }),
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Não foi possível traduzir a campanha agora.')
  }

  let parsed: any = null
  try {
    parsed = JSON.parse(String(payload?.choices?.[0]?.message?.content || ''))
  } catch {}

  const normalize = (value: any) => ({
    subject: String(value?.subject || '').trim(),
    preview: String(value?.preview || '').trim() || null,
    body: String(value?.body || '').trim(),
    ctaLabel: String(value?.ctaLabel || '').trim() || null,
  })

  const es = normalize(parsed?.es)
  const en = normalize(parsed?.en)
  if (!es.subject || !es.body || !en.subject || !en.body) {
    throw new Error('A tradução automática retornou conteúdo incompleto. Nenhum e-mail foi enviado.')
  }

  return { es, en }
}

async function ensureCampaignTranslations(campaign: EmailCampaign, campaignId: string) {
  const [{ count: esCount, error: esError }, { count: enCount, error: enError }] = await Promise.all([
    supabaseAdmin
      .from('admin_email_campaign_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('recipient_language', 'es'),
    supabaseAdmin
      .from('admin_email_campaign_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('recipient_language', 'en'),
  ])

  if (esError) throw esError
  if (enError) throw enError

  const needsEs = Number(esCount || 0) > 0
  const needsEn = Number(enCount || 0) > 0
  const hasEs = Boolean(campaign.translations?.es?.subject && campaign.translations?.es?.body)
  const hasEn = Boolean(campaign.translations?.en?.subject && campaign.translations?.en?.body)

  if ((!needsEs || hasEs) && (!needsEn || hasEn)) return campaign

  const translations = await translateCampaignContent(campaign)
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ translations, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select('*')
    .single()

  if (error) throw error
  return data as EmailCampaign
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
      recipient_country: recipient.country,
      recipient_language: recipient.language,
      status: 'pending',
      provider_message_id: null,
      error_message: null,
      sent_at: null,
    }))
    if (chunk.length === 0) continue
    const { error } = await supabaseAdmin.from('admin_email_campaign_deliveries').insert(chunk)
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error
  }

  const actualCount = await queueExists(campaign.id)
  const frozenAt = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({ target_count: actualCount, frozen_at: frozenAt, updated_at: frozenAt })
    .eq('id', campaign.id)
  if (updateError) throw updateError

  return actualCount
}

async function claimDelivery(row: DeliveryRow) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .update({
      status: 'skipped',
      error_message: DELIVERY_CLAIM_TAG,
      claimed_at: new Date().toISOString(),
    })
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
      claimed_at: null,
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

async function countReservedDeliveries(campaignId: string) {
  const { count, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'skipped')
    .eq('error_message', DELIVERY_CLAIM_TAG)
  if (error) throw error
  return Number(count || 0)
}

async function recoverStaleClaims(campaignId: string) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .update({
      status: 'pending',
      error_message: null,
      claimed_at: null,
    })
    .eq('campaign_id', campaignId)
    .eq('status', 'skipped')
    .eq('error_message', DELIVERY_CLAIM_TAG)
    .lt('claimed_at', staleBefore)

  if (error) throw error
}

export async function sendEmailCampaign(campaignId: string, options?: { limit?: number }) {
  const limit = Math.min(Math.max(Number(options?.limit || CAMPAIGN_BATCH_SIZE), 1), CAMPAIGN_BATCH_SIZE)
  let campaign = await getCampaign(campaignId)

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

  campaign = await ensureCampaignTranslations(campaign, campaignId)
  await recoverStaleClaims(campaignId)

  const { data: pendingRows, error: pendingError } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('id, recipient_type, recipient_id, recipient_email, recipient_name, recipient_country, recipient_language, status')
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
      const language: MarketingLanguage = row.recipient_language === 'es' || row.recipient_language === 'en'
        ? row.recipient_language
        : 'pt'
      const content = getCampaignContent(campaign, language)
      const trackedCtaUrl = content.ctaLabel && campaign.cta_url && row.recipient_id
        ? await createCampaignButtonUrl({
            campaignId,
            campaignName: campaign.name,
            recipientType: row.recipient_type,
            recipientId: row.recipient_id,
            recipientEmail: row.recipient_email,
            recipientName: row.recipient_name || undefined,
            ctaLabel: content.ctaLabel,
            ctaUrl: campaign.cta_url,
          })
        : null

      const result = await sendCampaignViaResend({
        to: row.recipient_email,
        name: row.recipient_name || (row.recipient_type === 'composer' ? 'Compositor' : 'Usuário'),
        language,
        subject: content.subject,
        preview: content.preview,
        body: content.body,
        ctaLabel: content.ctaLabel,
        ctaUrl: trackedCtaUrl || campaign.cta_url,
        unsubscribeUrl: getEmailOptOutUrl({
          email: row.recipient_email,
          recipientType: row.recipient_type,
          recipientId: row.recipient_id,
          campaignId,
        }),
        idempotencyKey: `admin-campaign/${campaignId}/${row.id}`,
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

  const pendingTotal = await countDeliveries(campaignId, 'pending')
  const reservedTotal = await countReservedDeliveries(campaignId)
  const sentTotal = await countDeliveries(campaignId, 'sent')
  const failedTotal = await countDeliveries(campaignId, 'failed')
  const skippedAll = await countDeliveries(campaignId, 'skipped')
  const skippedTotal = Math.max(0, skippedAll - reservedTotal)
  const remaining = pendingTotal + reservedTotal
  const nextStatus = remaining > 0 ? 'sending' : 'sent'
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
    sentTotal,
    failedTotal,
    skippedTotal,
    pendingTotal,
    reservedTotal,
    processedTotal: sentTotal + failedTotal + skippedTotal,
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
  const staleSendingBefore = new Date(now.getTime() - 2 * 60 * 1000).toISOString()

  const [scheduledResult, sendingResult] = await Promise.all([
    supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabaseAdmin
      .from('admin_email_campaigns')
      .select('*')
      .eq('status', 'sending')
      .lte('updated_at', staleSendingBefore)
      .order('updated_at', { ascending: true })
      .limit(5),
  ])

  if (scheduledResult.error) throw scheduledResult.error
  if (sendingResult.error) throw sendingResult.error

  const uniqueCampaigns = new Map<string, EmailCampaign>()
  for (const campaign of [...(scheduledResult.data || []), ...(sendingResult.data || [])]) {
    uniqueCampaigns.set((campaign as any).id, campaign as EmailCampaign)
  }

  const results = []
  for (const campaign of Array.from(uniqueCampaigns.values()).slice(0, 5)) {
    if (campaign.status === 'scheduled' && !shouldProcessCampaign(campaign, now)) continue
    results.push(await continueEmailCampaign(campaign.id, { limitPerCampaign: options?.limitPerCampaign }))
  }
  return results
}
