import { createHash } from 'crypto'
import { sendAdminStudioAlertEmail } from '@/lib/dcc-emails'

type PaymentProvider = 'mercadopago' | 'stripe' | 'checkout'

type PaymentFailureAlertInput = {
  provider: PaymentProvider
  stage: string
  error: unknown
  requestUrl?: string | null
  composerId?: string | null
  paymentId?: string | number | null
  orderId?: string | number | null
  amount?: number | null
  currency?: string | null
  metadata?: Record<string, unknown>
}

const ALERT_WINDOW_MS = 10 * 60 * 1000
const providerLabels: Record<PaymentProvider, string> = {
  mercadopago: 'Mercado Pago',
  stripe: 'Stripe',
  checkout: 'Checkout DCC Music',
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sanitizeErrorMessage(error: unknown) {
  const source = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : String((error as { message?: unknown } | null)?.message || 'Erro não identificado')

  return source
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [oculto]')
    .replace(/\b(?:APP_USR|TEST|sk_live|sk_test|pk_live|pk_test|whsec)[-_][A-Za-z0-9._-]+\b/gi, '[credencial oculta]')
    .slice(0, 800)
}

function isKnownDuplicateSubscriptionConstraint(error: unknown) {
  const candidate = error as {
    code?: unknown
    message?: unknown
    details?: unknown
    constraint?: unknown
  } | null

  const code = String(candidate?.code || '')
  const combined = [candidate?.message, candidate?.details, candidate?.constraint]
    .filter((value) => value != null)
    .map(String)
    .join(' ')
    .toLowerCase()

  return (
    code === '23505' &&
    combined.includes('dccmusic_subscriptions_composer_id_plan_id_status_key')
  )
}

function normalizeFailureFingerprint(message: string) {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/\b\d{5,}\b/g, '[id]')
    .replace(/\s+/g, ' ')
    .trim()
}

function markErrorAsReported(error: unknown) {
  if (!error || typeof error !== 'object') return

  try {
    Object.defineProperty(error, '__dccPaymentAlertReported', {
      value: true,
      configurable: true,
    })
  } catch {
    // Erros de terceiros podem ser imutáveis; a chave de evento ainda evita repetições.
  }
}

export async function reportPaymentFailure(input: PaymentFailureAlertInput) {
  if (isKnownDuplicateSubscriptionConstraint(input.error)) {
    console.warn('[PAYMENT ALERT] E-mail suprimido para duplicidade conhecida de assinatura ativa.', {
      provider: input.provider,
      stage: input.stage,
      paymentId: input.paymentId ?? null,
      composerId: input.composerId ?? null,
    })
    markErrorAsReported(input.error)
    return { sent: false, reason: 'known_duplicate_subscription_constraint' }
  }

  if ((input.error as { __dccPaymentAlertReported?: boolean } | null)?.__dccPaymentAlertReported) {
    return { sent: false, reason: 'already_reported_for_request' }
  }

  const message = sanitizeErrorMessage(input.error)
  const timestamp = new Date()
  const window = Math.floor(timestamp.getTime() / ALERT_WINDOW_MS)
  const fingerprint = createHash('sha256')
    .update(normalizeFailureFingerprint(message))
    .digest('hex')
    .slice(0, 16)
  const eventKey = `payment-failure/${input.provider}/${input.stage}/${fingerprint}/${window}`

  let route: string | null = null
  if (input.requestUrl) {
    try {
      route = new URL(input.requestUrl).pathname
    } catch {
      route = input.requestUrl.split('?')[0]
    }
  }

  const amount = Number.isFinite(input.amount) && input.amount != null
    ? Number(input.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: input.currency || 'BRL',
      })
    : null
  const details = [
    ['Provedor', providerLabels[input.provider]],
    ['Etapa', input.stage],
    ['Horário', timestamp.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Rota', route],
    ['Compositor', input.composerId],
    ['Pedido', input.orderId],
    ['Pagamento', input.paymentId],
    ['Valor', amount],
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join('')

  try {
    const result = await sendAdminStudioAlertEmail({
      title: `🚨 Alerta DCC Music — falha no ${providerLabels[input.provider]}`,
      message: `Uma falha técnica pode impedir a conclusão de um pagamento ou a liberação de créditos.\n\nErro: ${message}`,
      eventKey,
      detailsHtml: details,
      metadata: {
        provider: input.provider,
        stage: input.stage,
        error: message,
        route,
        composerId: input.composerId || null,
        paymentId: input.paymentId == null ? null : String(input.paymentId),
        orderId: input.orderId == null ? null : String(input.orderId),
        amount: input.amount ?? null,
        currency: input.currency || null,
        occurredAt: timestamp.toISOString(),
        ...(input.metadata || {}),
      },
    })

    markErrorAsReported(input.error)
    return result
  } catch (alertError) {
    markErrorAsReported(input.error)
    console.error('[PAYMENT ALERT] Não foi possível enviar o alerta administrativo:', alertError)
    return { sent: false, reason: 'alert_delivery_failed' }
  }
}
