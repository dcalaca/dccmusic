import {
  buildMetaCapiMetadata,
  mergeMetaBrowserContext,
  readMetaBrowserContextFromMetadata,
  sendMetaPurchaseEvent,
  type MetaBrowserContext,
} from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'

/**
 * Envia Purchase da recarga avulsa para Meta/TikTok.
 * O chamador deve executar esta função somente depois de conquistar a trava
 * idempotente da recarga (creditStudioTopupOnce retornando credited=true).
 * O event_id continua sendo o paymentId como proteção adicional.
 */
export async function sendStudioTopupPurchaseEvents(input: {
  request?: Request
  topup: any
  paymentId: string
  email: string
  paymentMetadata?: any
  eventSourceUrl?: string | null
}) {
  const paymentId = String(input.paymentId || '').trim()
  if (!paymentId) return { sent: false, reason: 'missing_payment_id' }

  const value = Number(input.topup?.amount) || 0
  if (value <= 0) return { sent: false, reason: 'invalid_value' }

  const browserContext: MetaBrowserContext = mergeMetaBrowserContext(
    readMetaBrowserContextFromMetadata(input.topup?.metadata),
    mergeMetaBrowserContext(
      readMetaBrowserContextFromMetadata(input.paymentMetadata),
      input.request
        ? buildMetaCapiMetadata(input.request, {
            email: input.email,
            externalId: input.topup.composer_id,
            eventSourceUrl: input.eventSourceUrl || input.request.headers.get('referer') || input.request.url,
          })
        : null
    )
  )

  const eventSourceUrl =
    input.eventSourceUrl ||
    browserContext.event_source_url ||
    process.env.NEXTAUTH_URL ||
    'https://www.dccmusic.online'

  const quantity = Number(input.topup?.music_quantity) || 1
  const currency = input.topup?.currency || 'BRL'

  const [meta, tiktok] = await Promise.allSettled([
    sendMetaPurchaseEvent({
      request: input.request,
      browserContext,
      eventId: paymentId,
      eventSourceUrl,
      email: input.email,
      externalId: input.topup.composer_id,
      value,
      currency,
      contentName: 'Recarga Studio IA',
      contentId: 'studio_topup',
      quantity,
    }),
    sendTikTokPurchaseEvent({
      request: input.request,
      eventId: paymentId,
      eventSourceUrl,
      email: input.email,
      externalId: input.topup.composer_id,
      value,
      currency,
      contentName: 'Recarga Studio IA',
      contentId: 'studio_topup',
      quantity,
    }),
  ])

  const metaResult = meta.status === 'fulfilled' ? meta.value : { sent: false, reason: 'rejected' }
  if (!metaResult.sent) {
    console.error('[Studio IA] Meta Purchase da recarga não enviado:', {
      paymentId,
      topupId: input.topup?.id,
      result: metaResult,
      tiktok: tiktok.status === 'fulfilled' ? tiktok.value : String(tiktok.reason),
    })
  } else {
    console.log('[Studio IA] Meta Purchase da recarga enviado:', {
      paymentId,
      topupId: input.topup?.id,
      hasFbp: Boolean(browserContext.fbp),
      hasFbc: Boolean(browserContext.fbc),
      hasUa: Boolean(browserContext.client_user_agent),
    })
  }

  return metaResult
}
