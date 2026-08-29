import crypto from 'crypto'

const STRIPE_API_URL = 'https://api.stripe.com/v1'
const STRIPE_API_VERSION = '2026-07-29.dahlia'

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim())
}

export async function stripeRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY não configurada')

  const response = await fetch(`${STRIPE_API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Erro ${response.status} ao comunicar com a Stripe`)
  return data as T
}

const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export async function getStripeSettlement(paymentIntentId: string) {
  const paymentIntent = await stripeRequest<any>(
    `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge.balance_transaction`,
    { method: 'GET' }
  )
  const balanceTransaction = paymentIntent?.latest_charge?.balance_transaction
  if (!balanceTransaction || typeof balanceTransaction === 'string') return null

  const currency = String(balanceTransaction.currency || '').toUpperCase()
  const minorAmount = Number(balanceTransaction.amount)
  if (!currency || !Number.isFinite(minorAmount)) return null

  return {
    amount: minorAmount / (STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100),
    currency,
    exchangeRate: Number(balanceTransaction.exchange_rate) || null,
    balanceTransactionId: balanceTransaction.id || null,
  }
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) return { ok: false, configured: false, reason: 'secret_not_configured' }
  if (!signatureHeader) return { ok: false, configured: true, reason: 'missing_signature_header' }

  let timestamp = ''
  const signatures: string[] = []
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.trim().split('=', 2)
    if (key === 't') timestamp = value || ''
    if (key === 'v1' && value) signatures.push(value)
  }
  if (!timestamp || signatures.length === 0) return { ok: false, configured: true, reason: 'malformed_signature_header' }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return { ok: false, configured: true, reason: 'timestamp_outside_tolerance' }

  const computed = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  const computedBuffer = Buffer.from(computed, 'utf8')
  const ok = signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'utf8')
    return signatureBuffer.length === computedBuffer.length && crypto.timingSafeEqual(signatureBuffer, computedBuffer)
  })
  return { ok, configured: true, reason: ok ? undefined : 'signature_mismatch' }
}

export function sanitizeStripeObject(value: any) {
  if (!value || typeof value !== 'object') return null
  return {
    id: value.id || null,
    object: value.object || null,
    status: value.status || null,
    payment_status: value.payment_status || null,
    amount_total: value.amount_total ?? value.amount ?? null,
    currency: value.currency || null,
    payment_intent: typeof value.payment_intent === 'string' ? value.payment_intent : value.payment_intent?.id || null,
    metadata: value.metadata || {},
    created: value.created || null,
  }
}
