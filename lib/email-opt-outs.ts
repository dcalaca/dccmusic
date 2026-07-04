import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from './supabase'

type EmailOptOutPayload = {
  email: string
  recipientType?: string | null
  recipientId?: string | null
  campaignId?: string | null
  iat: number
}

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dccmusic.online').replace(/\/$/, '')
}

function getSecret() {
  return process.env.EMAIL_OPTOUT_SECRET || process.env.NEXTAUTH_SECRET || process.env.RESEND_API_KEY || 'dccmusic-email-optout'
}

export function normalizeMarketingEmail(value: any) {
  return String(value || '').trim().toLowerCase()
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signPayload(payloadBase64: string) {
  return createHmac('sha256', getSecret()).update(payloadBase64).digest('base64url')
}

function isValidSignature(payloadBase64: string, signature: string) {
  const expected = signPayload(payloadBase64)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

function isMissingOptOutTableError(error: any) {
  const message = String(error?.message || error?.details || error || '').toLowerCase()
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('admin_email_opt_outs') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export function createEmailOptOutToken(input: {
  email: string
  recipientType?: string | null
  recipientId?: string | null
  campaignId?: string | null
}) {
  const payload: EmailOptOutPayload = {
    email: normalizeMarketingEmail(input.email),
    recipientType: input.recipientType || null,
    recipientId: input.recipientId || null,
    campaignId: input.campaignId || null,
    iat: Date.now(),
  }
  const payloadBase64 = encodeBase64Url(JSON.stringify(payload))
  return `${payloadBase64}.${signPayload(payloadBase64)}`
}

export function verifyEmailOptOutToken(token: string): EmailOptOutPayload | null {
  const [payloadBase64, signature] = String(token || '').split('.')
  if (!payloadBase64 || !signature || !isValidSignature(payloadBase64, signature)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'))
    const email = normalizeMarketingEmail(payload?.email)
    if (!email || !email.includes('@')) return null
    return {
      email,
      recipientType: payload.recipientType || null,
      recipientId: payload.recipientId || null,
      campaignId: payload.campaignId || null,
      iat: Number(payload.iat) || Date.now(),
    }
  } catch {
    return null
  }
}

export function getEmailOptOutUrl(input: {
  email: string
  recipientType?: string | null
  recipientId?: string | null
  campaignId?: string | null
}) {
  const token = createEmailOptOutToken(input)
  return `${getSiteUrl()}/email/descadastrar?token=${encodeURIComponent(token)}`
}

export async function getOptedOutEmailSet() {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_email_opt_outs')
      .select('email')

    if (error) throw error
    return new Set((data || []).map((row: any) => normalizeMarketingEmail(row.email)).filter(Boolean))
  } catch (error) {
    if (isMissingOptOutTableError(error)) return new Set<string>()
    throw error
  }
}

export async function recordEmailOptOut(input: {
  token: string
  userAgent?: string | null
  ipAddress?: string | null
}) {
  const payload = verifyEmailOptOutToken(input.token)
  if (!payload) {
    return { success: false as const, reason: 'invalid_token' as const }
  }

  const { error } = await supabaseAdmin
    .from('admin_email_opt_outs')
    .upsert({
      email: payload.email,
      recipient_type: payload.recipientType || null,
      recipient_id: payload.recipientId || null,
      campaign_id: payload.campaignId || null,
      user_agent: input.userAgent || null,
      ip_address: input.ipAddress || null,
      opted_out_at: new Date().toISOString(),
    }, { onConflict: 'email' })

  if (error) {
    if (isMissingOptOutTableError(error)) {
      return { success: false as const, reason: 'setup_required' as const }
    }
    throw error
  }

  return { success: true as const, email: payload.email }
}
