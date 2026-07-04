import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import crypto from 'crypto'

// Configuração do Mercado Pago
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

if (!accessToken) {
  console.error('[MERCADOPAGO] ⚠️ MERCADOPAGO_ACCESS_TOKEN não configurado!')
}

const client = new MercadoPagoConfig({
  accessToken: accessToken || '',
  options: {
    timeout: 10000, // Aumentado para produção
    idempotencyKey: 'dccmusic-' + Date.now(), // Único por requisição
  },
})

export const mercadoPagoClient = client
export const preferenceClient = new Preference(client)
export const paymentClient = new Payment(client)

export interface MercadoPagoWebhookVerification {
  ok: boolean
  configured: boolean
  reason?: string
}

/**
 * Valida a assinatura (x-signature) enviada pelo Mercado Pago nos webhooks.
 *
 * Segue o algoritmo oficial: monta o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * e compara o HMAC-SHA256 (com a MERCADOPAGO_WEBHOOK_SECRET) contra o `v1` do header.
 *
 * - Se o segredo NÃO estiver configurado, retorna { ok: true, configured: false }
 *   (não bloqueia; o chamador deve registrar um aviso e confiar na 2ª trava de confirmar na API).
 * - Se o segredo estiver configurado e a assinatura for ausente/inválida, retorna { ok: false }.
 */
export function verifyMercadoPagoWebhookSignature(
  request: Request,
  dataIdFallback?: string | number | null
): MercadoPagoWebhookVerification {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return { ok: true, configured: false, reason: 'secret_not_configured' }
  }

  const xSignature = request.headers.get('x-signature') || ''
  const xRequestId = request.headers.get('x-request-id') || ''

  if (!xSignature) {
    return { ok: false, configured: true, reason: 'missing_signature_header' }
  }

  let ts = ''
  let v1 = ''
  for (const part of xSignature.split(',')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) continue
    const key = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()
    if (key === 'ts') ts = value
    else if (key === 'v1') v1 = value
  }

  if (!ts || !v1) {
    return { ok: false, configured: true, reason: 'malformed_signature_header' }
  }

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get('data.id') || url.searchParams.get('id')
  const resolvedId = String(idFromQuery ?? dataIdFallback ?? '')
  const normalizedId = /^[a-zA-Z0-9]+$/.test(resolvedId) ? resolvedId.toLowerCase() : resolvedId

  const manifestParts: string[] = []
  if (normalizedId) manifestParts.push(`id:${normalizedId};`)
  if (xRequestId) manifestParts.push(`request-id:${xRequestId};`)
  manifestParts.push(`ts:${ts};`)
  const manifest = manifestParts.join('')

  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  const computedBuffer = Buffer.from(computed, 'utf8')
  const signatureBuffer = Buffer.from(v1, 'utf8')
  const isValid =
    computedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(computedBuffer, signatureBuffer)

  return {
    ok: isValid,
    configured: true,
    reason: isValid ? undefined : 'signature_mismatch',
  }
}

// URLs de retorno (ajustar conforme necessário)
export const getReturnUrls = (subscriptionId: string) => ({
  success: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/compositores/pagamento/sucesso?subscription_id=${subscriptionId}`,
  failure: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/compositores/pagamento/falha?subscription_id=${subscriptionId}`,
  pending: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/compositores/pagamento/pendente?subscription_id=${subscriptionId}`,
})
