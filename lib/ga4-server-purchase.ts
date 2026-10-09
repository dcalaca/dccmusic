import type { NextRequest } from 'next/server'

/**
 * Measurement Protocol backup for a confirmed Studio top-up.
 * Reuses the browser's GA4 client ID, never creates a synthetic visitor,
 * and uses the same transaction_id as the web purchase for GA4 deduplication.
 */
const MEASUREMENT_ID = 'G-CNBQFWQ9QT'

function cookieClientId(rawCookie: string | null): string | null {
  if (!rawCookie) return null
  const cookie = rawCookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('_ga='))
  if (!cookie) return null
  const value = decodeURIComponent(cookie.slice(4))
  const match = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(value)
  return match ? match[1] : null
}

export function ga4ClientIdFromRequest(request: Request): string | null {
  return cookieClientId(request.headers.get('cookie'))
}

export function ga4SessionIdFromRequest(request: Request): string | null {
  const raw = request.headers.get('cookie')
  if (!raw) return null
  const part = raw.split(';').map((value) => value.trim()).find((value) => value.startsWith('_ga_CNBQFWQ9QT='))
  if (!part) return null
  const decoded = decodeURIComponent(part.slice('_ga_CNBQFWQ9QT='.length))
  // GA4 uses both the older GS1.1.<sessionId> and newer GS2.1.s<sessionId> cookie shapes.
  const match = /^(?:GS\d+\.\d+\.)(?:s)?(\d{9,13})(?:[.$]|$)/.exec(decoded)
  return match ? match[1] : null
}

export function ga4CheckoutMetadata(request: Request): Record<string, string> {
  const clientId = ga4ClientIdFromRequest(request)
  const sessionId = ga4SessionIdFromRequest(request)
  return {
    ...(clientId ? { client_id: clientId } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
  }
}

export async function sendConfirmedTopupGa4Purchase(input: {
  request?: NextRequest
  topup: any
}): Promise<{ sent: boolean; reason: string }> {
  const secret = process.env.GA4_API_SECRET
  if (!secret) return { sent: false, reason: 'ga4_secret_missing' }
  const topup = input.topup
  if (!topup?.id || topup.status !== 'paid') return { sent: false, reason: 'not_approved' }

  const clientId = String(topup.metadata?.ga4?.client_id || (input.request && ga4ClientIdFromRequest(input.request)) || '')
  const sessionId = String(topup.metadata?.ga4?.session_id || (input.request && ga4SessionIdFromRequest(input.request)) || '')
  if (!/^\d+\.\d+$/.test(clientId)) return { sent: false, reason: 'client_id_unavailable' }

  const value = Number(topup.amount)
  const currency = String(topup.currency || '').toUpperCase()
  if (!Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return { sent: false, reason: 'invalid_amount_or_currency' }
  }

  const params: Record<string, unknown> = {
    transaction_id: 'topup_' + topup.id,
    value,
    currency,
    engagement_time_msec: 1,
    items: [{ item_id: 'studio_topup', item_name: 'Recarga Studio IA', quantity: 1, price: value }],
  }
  if (/^\d{9,13}$/.test(sessionId)) params.session_id = Number(sessionId)

  try {
    const response = await fetch('https://www.google-analytics.com/mp/collect?measurement_id=' +
      encodeURIComponent(MEASUREMENT_ID) + '&api_secret=' + encodeURIComponent(secret), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, events: [{ name: 'purchase', params }] }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!response.ok) {
      console.error('[GA4 server purchase] Transport failed', { topupId: topup.id, status: response.status })
      return { sent: false, reason: 'http_' + response.status }
    }
    console.info('[GA4 server purchase] Submitted', { topupId: topup.id, hasSessionId: Boolean(params.session_id) })
    // A 2xx response means accepted at the transport layer, not yet counted in GA4.
    return { sent: true, reason: 'submitted' }
  } catch (error) {
    console.error('[GA4 server purchase] Request failed', { topupId: topup.id, error: String(error) })
    return { sent: false, reason: 'request_error' }
  }
}
