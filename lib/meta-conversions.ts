import { createHash } from 'crypto'

const DEFAULT_META_PIXEL_ID = '1706895963831738'

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

export async function sendMetaPurchaseEvent(input: {
  request?: Request
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

  const browserIds = getBrowserIds(input.request)
  const externalIdHash = sha256(input.externalId)
  const payload: any = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
        user_data: {
          em: sha256(input.email) ? [sha256(input.email)] : undefined,
          ph: sha256(input.phone) ? [sha256(input.phone)] : undefined,
          external_id: externalIdHash ? [externalIdHash] : undefined,
          client_ip_address: getClientIp(input.request),
          client_user_agent: input.request?.headers.get('user-agent') || undefined,
          fbp: browserIds.fbp,
          fbc: browserIds.fbc,
        },
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

  const browserIds = getBrowserIds(input.request)
  const externalIdHash = sha256(input.externalId)
  const payload: any = {
    data: [
      {
        event_name: 'InitiateCheckout',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
        user_data: {
          em: sha256(input.email) ? [sha256(input.email)] : undefined,
          ph: sha256(input.phone) ? [sha256(input.phone)] : undefined,
          external_id: externalIdHash ? [externalIdHash] : undefined,
          client_ip_address: getClientIp(input.request),
          client_user_agent: input.request?.headers.get('user-agent') || undefined,
          fbp: browserIds.fbp,
          fbc: browserIds.fbc,
        },
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

  const browserIds = getBrowserIds(input.request)
  const externalIdHash = sha256(input.externalId)
  const payload: any = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online/compositores/cadastro',
        user_data: {
          em: sha256(input.email) ? [sha256(input.email)] : undefined,
          ph: sha256(input.phone) ? [sha256(input.phone)] : undefined,
          external_id: externalIdHash ? [externalIdHash] : undefined,
          client_ip_address: getClientIp(input.request),
          client_user_agent: input.request?.headers.get('user-agent') || undefined,
          fbp: browserIds.fbp,
          fbc: browserIds.fbc,
        },
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
