import { createHash } from 'crypto'
import { isIP } from 'net'
import { readMetaBrowserContextFromMetadata } from '@/lib/meta-conversions'

const PIXEL_ID = '7P9kR7YDnZBmFo76pXpiAq'
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000

type Purchase = {
  transactionId: string
  amount: unknown
  currency: unknown
  paidAt: unknown
  composerId: string
  email?: string
  metadata?: any
  contentId: 'studio_topup' | 'composer_plan'
  quantity?: number
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

/** Transport acceptance is logged separately from eventual attribution. Never throws. */
export async function sendOpenAIAdsPurchase(input: Purchase) {
  try {
    const key = process.env.OPENAI_CONVERSIONS_API_KEY?.trim()
    if (!key) return { sent: false, reason: 'not_configured' }
    const timestamp = new Date(String(input.paidAt || '')).getTime()
    const age = Date.now() - timestamp
    if (!Number.isFinite(timestamp) || age > MAX_EVENT_AGE_MS || age < -600000) {
      return { sent: false, reason: 'invalid_or_expired_payment_time' }
    }
    const amount = Number(input.amount)
    const currency = String(input.currency || '').toUpperCase()
    if (!input.transactionId || !Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return { sent: false, reason: 'invalid_payment' }
    }
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits!
    const minorAmount = Math.round(amount * 10 ** digits)
    if (!Number.isSafeInteger(minorAmount)) return { sent: false, reason: 'invalid_payment' }
    const context = input.metadata?.openai_ads || {}
    // Older checkouts already saved browser context. Never use webhook IP/UA.
    const browser = readMetaBrowserContextFromMetadata(input.metadata)
    const canonical = new URL(process.env.NEXTAUTH_URL || 'https://www.dccmusic.online')
    let sourceUrl = canonical.origin + '/compositores/admin/studio-ia'
    try {
      const url = new URL(context.source_url || browser?.event_source_url || '')
      if (['http:', 'https:'].includes(url.protocol) && url.origin === canonical.origin) sourceUrl = url.origin + url.pathname
    } catch { /* Use canonical fallback. */ }
    const email = String(input.email || browser?.email || '').trim().toLowerCase()
    const externalId = String(input.composerId || '').trim()
    const ip = context.ip_address || browser?.client_ip_address
    const country = String(input.metadata?.customer_country || '').toUpperCase()
    const event = {
      id: 'dcc_order_' + input.transactionId,
      type: 'order_created',
      timestamp_ms: timestamp,
      action_source: 'web',
      source_url: sourceUrl,
      ...(context.oppref ? { oppref: context.oppref } : {}),
      user: {
        ...(context.obref ? { obref: context.obref } : {}),
        ...(email ? { emails_sha256: [hash(email)] } : {}),
        ...(externalId ? { external_ids_sha256: [hash(externalId)] } : {}),
        ...(typeof ip === 'string' && isIP(ip) ? { ip_address: ip } : {}),
        ...(context.user_agent || browser?.client_user_agent ? { user_agent: context.user_agent || browser?.client_user_agent } : {}),
        ...(/^[A-Z]{2}$/.test(country) ? { countries: [country] } : {}),
      },
      data: {
        type: 'contents', amount: minorAmount, currency,
        contents: [{ id: input.contentId, content_type: 'product', quantity: Math.max(1, Math.round(input.quantity || 1)) }],
      },
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('https://bzr.openai.com/v1/events?pid=' + PIXEL_ID, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ validate_only: false, events: [event] }),
          signal: AbortSignal.timeout(2500), cache: 'no-store',
        })
        if (response.ok) {
          console.info('[OpenAI Ads CAPI] Submitted', { eventId: event.id })
          return { sent: true, reason: 'submitted' }
        }
        // Retry transient failures with the exact same event and timestamp.
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue
        console.warn('[OpenAI Ads CAPI] Rejected', { eventId: event.id, status: response.status })
        return { sent: false, reason: 'http_' + response.status }
      } catch {
        if (attempt === 0) continue
        console.warn('[OpenAI Ads CAPI] Transport failed', { eventId: event.id })
      }
    }
    return { sent: false, reason: 'transport_failed' }
  } catch {
    console.warn('[OpenAI Ads CAPI] Event construction failed')
    return { sent: false, reason: 'event_failed' }
  }
}

export async function sendOpenAIAdsTopupPurchase(topup: any, email?: string) {
  try {
    if (topup?.status !== 'paid' || !topup?.id) return { sent: false, reason: 'not_paid' }
    return await sendOpenAIAdsPurchase({
      transactionId: 'topup_' + topup.id, amount: topup.amount, currency: topup.currency,
      paidAt: topup.paid_at, composerId: topup.composer_id, email,
      metadata: topup.metadata, contentId: 'studio_topup', quantity: topup.music_quantity,
    })
  } catch { return { sent: false, reason: 'event_failed' } }
}

/** Read the paid ledger record so plans use actual charged currency/value and the browser's database ID. */
export async function sendOpenAIAdsPlanPurchase(paymentId: string, composerId: string, metadata?: any, email?: string) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { data, error } = await supabaseAdmin.from('dccmusic_payments')
      .select('id, amount, currency, paid_at').eq('gateway_payment_id', paymentId)
      .eq('composer_id', composerId).eq('status', 'paid').maybeSingle()
    if (error || !data) return { sent: false, reason: 'paid_payment_unavailable' }
    return await sendOpenAIAdsPurchase({
      transactionId: 'plan_' + data.id, amount: data.amount, currency: data.currency,
      paidAt: data.paid_at, composerId, metadata, email, contentId: 'composer_plan',
    })
  } catch { return { sent: false, reason: 'event_failed' } }
}
