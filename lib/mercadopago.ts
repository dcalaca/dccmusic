import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import crypto from 'crypto'

// Configuração do Mercado Pago
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
const MERCADOPAGO_API_BASE_URL = 'https://api.mercadopago.com'
const MERCADOPAGO_TIMEOUT_MS = 10_000

if (!accessToken) {
  console.error('[MERCADOPAGO] ⚠️ MERCADOPAGO_ACCESS_TOKEN não configurado!')
}

const client = new MercadoPagoConfig({
  accessToken: accessToken || '',
  options: {
    timeout: MERCADOPAGO_TIMEOUT_MS,
    idempotencyKey: 'dccmusic-' + Date.now(),
  },
})

function responseHeadersRecord(headers: Headers) {
  const result: Record<string, string[]> = {}
  headers.forEach((value, key) => {
    result[key] = [value]
  })
  return result
}

async function mercadoPagoNativeRequest(input: {
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  idempotencyKey?: string
  timeout?: number
}) {
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  }
  if (!input.path.startsWith('/')) {
    throw new Error('Caminho inválido da API Mercado Pago')
  }

  const url = new URL(input.path, MERCADOPAGO_API_BASE_URL)
  if (url.origin !== MERCADOPAGO_API_BASE_URL) {
    throw new Error('Destino inválido da API Mercado Pago')
  }

  const controller = new AbortController()
  const timeoutMs = Math.max(1_000, Number(input.timeout) || MERCADOPAGO_TIMEOUT_MS)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    }
    if (input.body !== undefined) headers['Content-Type'] = 'application/json'
    if (input.idempotencyKey) headers['X-Idempotency-Key'] = input.idempotencyKey

    const response = await fetch(url, {
      method: input.method || 'GET',
      headers,
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)
    const apiResponse = {
      status: response.status,
      headers: responseHeadersRecord(response.headers),
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.cause?.[0]?.description ||
        `Mercado Pago retornou HTTP ${response.status}`
      const error: any = new Error(String(message))
      if (payload && typeof payload === 'object') Object.assign(error, payload)
      error.status = response.status
      error.api_response = apiResponse
      throw error
    }

    if (payload && typeof payload === 'object') {
      payload.api_response = apiResponse
    }
    return payload
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError: any = new Error('Tempo limite ao consultar o Mercado Pago')
      timeoutError.status = 504
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * O SDK 2.x do Mercado Pago usa node-fetch antigo internamente, que aciona
 * DEP0169 (`url.parse()`) nas versões atuais do Node. Mantemos o SDK para as
 * demais operações, mas GET/CREATE de pagamentos — justamente os caminhos
 * usados por checkout, sync e webhook — usam o fetch nativo do Node.
 */
class NativeFetchPaymentClient extends Payment {
  get(input: any): any {
    const paymentId = String(input?.id ?? '').trim()
    if (!paymentId) throw new Error('Payment ID obrigatório')

    return mercadoPagoNativeRequest({
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
      method: 'GET',
      timeout: input?.requestOptions?.timeout,
    })
  }

  create(input: any): any {
    return mercadoPagoNativeRequest({
      path: '/v1/payments',
      method: 'POST',
      body: input?.body,
      idempotencyKey:
        input?.requestOptions?.idempotencyKey ||
        `dccmusic-${crypto.randomUUID()}`,
      timeout: input?.requestOptions?.timeout,
    })
  }
}

export const mercadoPagoClient = client
export const preferenceClient = new Preference(client)
export const paymentClient = new NativeFetchPaymentClient(client)

export interface MercadoPagoWebhookVerification {
  ok: boolean
  configured: boolean
  reason?: string
}

/**
 * Identifica notificações IPN legadas do Mercado Pago.
 *
 * O IPN chega apenas com `topic`/`id` na query (ou `type`/`id`) e sem o
 * envelope JSON dos Webhooks atuais. Apesar de poder conter `x-signature`,
 * esse formato não pode ser validado com a chave secreta de Webhooks.
 */
export function isMercadoPagoLegacyIpnNotification(request: Request, body: any): boolean {
  const url = new URL(request.url)
  const paymentId = url.searchParams.get('id')
  const topic = url.searchParams.get('topic') || url.searchParams.get('type')
  const hasModernDataId = url.searchParams.has('data.id')
  const hasModernEnvelope = Boolean(body?.type || body?.action || body?.data?.id)

  return Boolean(
    paymentId &&
    topic === 'payment' &&
    !hasModernDataId &&
    !hasModernEnvelope
  )
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
