import { createHash } from 'crypto'

const DEFAULT_TIKTOK_PIXEL_ID = 'D8CPURJC77U9J3L26K8G'

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

function getTikTokCookies(request?: Request) {
  const cookie = request?.headers.get('cookie') || ''
  const ttclid = cookie.match(/(?:^|;\s*)ttclid=([^;]+)/)?.[1]
  const ttp = cookie.match(/(?:^|;\s*)_ttp=([^;]+)/)?.[1]

  return { ttclid, ttp }
}

async function sendTikTokEvent(input: {
  request?: Request
  event: 'CompleteRegistration' | 'CompletePayment'
  eventId: string
  eventSourceUrl?: string | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
  value?: number
  currency?: string | null
  contentName: string
  contentId: string
  quantity?: number
}) {
  const accessToken = process.env.TIKTOK_EVENTS_ACCESS_TOKEN?.trim()
  const pixelId = process.env.TIKTOK_PIXEL_ID?.trim() || DEFAULT_TIKTOK_PIXEL_ID
  if (!accessToken || !pixelId) return { sent: false, reason: 'not_configured' }

  const value = Number(input.value) || 0
  if (input.event === 'CompletePayment' && value <= 0) return { sent: false, reason: 'invalid_value' }

  const cookies = getTikTokCookies(input.request)
  const quantity = input.quantity || 1
  const testEventCode = process.env.TIKTOK_TEST_EVENT_CODE?.trim()
  const payload = {
    event_source: 'web',
    event_source_id: pixelId,
    test_event_code: testEventCode || undefined,
    data: [
      {
        event: input.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        page: {
          url: input.eventSourceUrl || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
        },
        user: {
          email: sha256(input.email),
          phone: sha256(input.phone),
          external_id: sha256(input.externalId),
          ip: getClientIp(input.request),
          user_agent: input.request?.headers.get('user-agent') || undefined,
          ttclid: cookies.ttclid,
          ttp: cookies.ttp,
        },
        properties: {
          contents: [
            {
              content_id: input.contentId,
              content_type: 'product',
              content_name: input.contentName,
              price: value > 0 ? value / quantity : undefined,
              quantity,
            },
          ],
          content_type: 'product',
          content_name: input.contentName,
          currency: input.currency || 'BRL',
          value: input.event === 'CompletePayment' ? value : (input.value ?? 0.01),
        },
      },
    ],
  }

  const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: {
      'Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok || result?.code !== 0) {
    console.error('[TikTok Events API] Erro ao enviar evento:', {
      event: input.event,
      code: result?.code,
      message: result?.message,
      requestId: result?.request_id,
    })
    return { sent: false, reason: 'request_failed', result }
  }

  return { sent: true, result }
}

export async function sendTikTokCompleteRegistrationEvent(input: {
  eventId: string
  eventSourceUrl?: string | null
  email?: string | null
  externalId?: string | null
}) {
  return sendTikTokEvent({
    event: 'CompleteRegistration',
    contentId: 'composer_registration',
    contentName: 'Cadastro de compositor',
    currency: 'BRL',
    value: 0.01,
    ...input,
  })
}

export async function sendTikTokPurchaseEvent(input: {
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
  return sendTikTokEvent({
    event: 'CompletePayment',
    ...input,
  })
}
