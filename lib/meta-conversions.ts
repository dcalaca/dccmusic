import { createHash } from 'crypto'

const DEFAULT_META_PIXEL_ID = '1706895963831738'

export type MetaBrowserContext = {
  fbp?: string | null
  fbc?: string | null
  client_ip_address?: string | null
  client_user_agent?: string | null
  event_source_url?: string | null
  email?: string | null
  external_id?: string | null
  captured_at?: string | null
}

function sha256(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return undefined
  return createHash('sha256').update(normalized).digest('hex')
}

function getClientIp(request?: Request) {
  const forwardedFor = request?.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || undefined
  return request?.headers.get('x-real-ip') || undefined
}

function getBrowserIds(request?: Request) {
  const cookie = request?.headers.get('cookie') || ''
  const fbp = cookie.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1]
  const fbc = cookie.match(/(?:^|;\s*)_fbc=([^;]+)/)?.[1]

  return {
    fbp,
    fbc,
  }
}

export function extractMetaBrowserContext(request?: Request): MetaBrowserContext {
  const browserIds = getBrowserIds(request)
  return {
    fbp: browserIds.fbp || null,
    fbc: browserIds.fbc || null,
    client_ip_address: getClientIp(request) || null,
    client_user_agent: request?.headers.get('user-agent') || null,
    event_source_url: request?.headers.get('referer') || null,
  }
}

export function mergeMetaBrowserContext(
  primary?: MetaBrowserContext | null,
  fallback?: MetaBrowserContext | null
): MetaBrowserContext {
  return {
    fbp: primary?.fbp || fallback?.fbp || null,
    fbc: primary?.fbc || fallback?.fbc || null,
    client_ip_address: primary?.client_ip_address || fallback?.client_ip_address || null,
    client_user_agent: primary?.client_user_agent || fallback?.client_user_agent || null,
    event_source_url: primary?.event_source_url || fallback?.event_source_url || null,
    email: primary?.email || fallback?.email || null,
    external_id: primary?.external_id || fallback?.external_id || null,
    captured_at: primary?.captured_at || fallback?.captured_at || null,
  }
}

function parseMaybeJson(value: unknown) {
  if (!value) return null
  if (typeof value === 'object') return value as Record<string, any>
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null
  } catch {
    return null
  }
}

/** Lê atribuição salva no metadata do topup/assinatura ou no metadata stringificado do Mercado Pago. */
export function readMetaBrowserContextFromMetadata(metadata: any): MetaBrowserContext | null {
  if (!metadata || typeof metadata !== 'object') return null

  const nested =
    parseMaybeJson(metadata.meta_capi) ||
    parseMaybeJson(metadata.meta_capi_json)

  const fbp = nested?.fbp || metadata.meta_capi_fbp || metadata.fbp || null
  const fbc = nested?.fbc || metadata.meta_capi_fbc || metadata.fbc || null
  const clientIp =
    nested?.client_ip_address ||
    nested?.clientIp ||
    metadata.meta_capi_ip ||
    metadata.client_ip_address ||
    null
  const userAgent =
    nested?.client_user_agent ||
    nested?.userAgent ||
    metadata.meta_capi_ua ||
    metadata.client_user_agent ||
    null
  const eventSourceUrl =
    nested?.event_source_url ||
    nested?.eventSourceUrl ||
    metadata.meta_capi_url ||
    metadata.event_source_url ||
    null

  if (!fbp && !fbc && !clientIp && !userAgent) return null

  return {
    fbp: fbp || null,
    fbc: fbc || null,
    client_ip_address: clientIp || null,
    client_user_agent: userAgent || null,
    event_source_url: eventSourceUrl || null,
    email: nested?.email || metadata.meta_capi_email || null,
    external_id: nested?.external_id || nested?.externalId || metadata.meta_capi_external_id || null,
    captured_at: nested?.captured_at || null,
  }
}

/** Campos string-safe para metadata do Mercado Pago (não aceita objeto aninhado). */
export function toMercadoPagoMetaCapiFields(metaCapi: MetaBrowserContext) {
  return {
    meta_capi_fbp: metaCapi.fbp || '',
    meta_capi_fbc: metaCapi.fbc || '',
    meta_capi_ip: metaCapi.client_ip_address || '',
    meta_capi_ua: metaCapi.client_user_agent || '',
    meta_capi_url: metaCapi.event_source_url || '',
    meta_capi_email: metaCapi.email || '',
    meta_capi_external_id: metaCapi.external_id || '',
    meta_capi_json: JSON.stringify(metaCapi),
  }
}

/** Captura identificadores do navegador no checkout para reutilizar no webhook. */
export function buildMetaCapiMetadata(
  request: Request,
  extra?: { email?: string | null; externalId?: string | null; eventSourceUrl?: string | null }
) {
  const fromRequest = extractMetaBrowserContext(request)
  return {
    fbp: fromRequest.fbp,
    fbc: fromRequest.fbc,
    client_ip_address: fromRequest.client_ip_address,
    client_user_agent: fromRequest.client_user_agent,
    event_source_url: extra?.eventSourceUrl || fromRequest.event_source_url || null,
    email: extra?.email || null,
    external_id: extra?.externalId || null,
    captured_at: new Date().toISOString(),
  }
}

function buildUserData(input: {
  request?: Request
  browserContext?: MetaBrowserContext | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
}) {
  const browser = mergeMetaBrowserContext(input.browserContext, extractMetaBrowserContext(input.request))
  const email = input.email || browser.email
  const externalId = input.externalId || browser.external_id
  const emailHash = sha256(email)
  const phoneHash = sha256(input.phone)
  const externalIdHash = sha256(externalId)

  return {
    browser,
    user_data: {
      em: emailHash ? [emailHash] : undefined,
      ph: phoneHash ? [phoneHash] : undefined,
      external_id: externalIdHash ? [externalIdHash] : undefined,
      client_ip_address: browser.client_ip_address || undefined,
      client_user_agent: browser.client_user_agent || undefined,
      fbp: browser.fbp || undefined,
      fbc: browser.fbc || undefined,
    },
  }
}

export async function sendMetaPurchaseEvent(input: {
  request?: Request
  browserContext?: MetaBrowserContext | null
  eventId: string
  eventSourceUrl?: string | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
  value: number
  currency?: string | null
  contentName: string
  contentId: string
  quantity?: number
}) {
  const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim()
  const pixelId = process.env.META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID
  if (!accessToken || !pixelId) return { sent: false, reason: 'not_configured' }

  const value = Number(input.value)
  if (!Number.isFinite(value) || value <= 0) return { sent: false, reason: 'invalid_value' }

  const { browser, user_data } = buildUserData(input)
  const payload: any = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url:
          input.eventSourceUrl ||
          browser.event_source_url ||
          process.env.NEXTAUTH_URL ||
          'https://www.dccmusic.online',
        user_data,
        custom_data: {
          currency: input.currency || 'BRL',
          value,
          content_name: input.contentName,
          content_type: 'product',
          contents: [
            {
              id: input.contentId,
              quantity: input.quantity || 1,
            },
          ],
        },
      },
    ],
  }

  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim()
  if (testEventCode) payload.test_event_code = testEventCode

  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[Meta CAPI] Erro ao enviar Purchase:', result)
    return { sent: false, reason: 'request_failed', result }
  }

  return { sent: true, result }
}

export async function sendMetaInitiateCheckoutEvent(input: {
  request?: Request
  browserContext?: MetaBrowserContext | null
  eventId: string
  eventSourceUrl?: string | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
  value: number
  currency?: string | null
  contentName: string
  contentId: string
  quantity?: number
}) {
  const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim()
  const pixelId = process.env.META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID
  if (!accessToken || !pixelId) return { sent: false, reason: 'not_configured' }

  const value = Number(input.value)
  if (!Number.isFinite(value) || value <= 0) return { sent: false, reason: 'invalid_value' }

  const { browser, user_data } = buildUserData(input)
  const payload: any = {
    data: [
      {
        event_name: 'InitiateCheckout',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url:
          input.eventSourceUrl ||
          browser.event_source_url ||
          process.env.NEXTAUTH_URL ||
          'https://www.dccmusic.online',
        user_data,
        custom_data: {
          currency: input.currency || 'BRL',
          value,
          content_name: input.contentName,
          content_type: 'product',
          contents: [
            {
              id: input.contentId,
              quantity: input.quantity || 1,
            },
          ],
        },
      },
    ],
  }

  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim()
  if (testEventCode) payload.test_event_code = testEventCode

  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[Meta CAPI] Erro ao enviar InitiateCheckout:', result)
    return { sent: false, reason: 'request_failed', result }
  }

  return { sent: true, result }
}

export async function sendMetaCompleteRegistrationEvent(input: {
  request?: Request
  browserContext?: MetaBrowserContext | null
  eventId: string
  eventSourceUrl?: string | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
  contentName?: string | null
}) {
  const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim()
  const pixelId = process.env.META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID
  if (!accessToken || !pixelId) return { sent: false, reason: 'not_configured' }

  const { browser, user_data } = buildUserData(input)
  const payload: any = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url:
          input.eventSourceUrl ||
          browser.event_source_url ||
          process.env.NEXTAUTH_URL ||
          'https://www.dccmusic.online/compositores/cadastro',
        user_data,
        custom_data: {
          content_name: input.contentName || 'Cadastro de compositor',
          status: 'success',
          currency: 'BRL',
          value: 0.01,
        },
      },
    ],
  }

  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim()
  if (testEventCode) payload.test_event_code = testEventCode

  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[Meta CAPI] Erro ao enviar CompleteRegistration:', result)
    return { sent: false, reason: 'request_failed', result }
  }

  return { sent: true, result }
}
