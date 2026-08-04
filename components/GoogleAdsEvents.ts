'use client'

/** Tag antiga (ainda válida se a ação existir no Ads). */
const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-16698092699/uJPVCL7Ew9EZEJvZopo-'

/** Evento da nova ação PURCHASE criada no assistente do Google Ads. */
const GOOGLE_ADS_PURCHASE_EVENT = 'conversion_event_purchase'

function getGtag(): ((...args: any[]) => void) | null {
  if (typeof window === 'undefined') return null
  const gtag = (window as any).gtag
  return typeof gtag === 'function' ? gtag : null
}

/**
 * Dispara conversão de compra para Google Ads + evento purchase do GA4.
 * Deduplica por transactionId na sessão do navegador.
 */
export function trackGoogleAdsPurchaseConversion({
  transactionId,
  value,
  currency = 'BRL',
}: {
  transactionId?: string | null
  value?: number
  currency?: string | null
}) {
  const gtag = getGtag()
  if (!gtag) return

  const tx = String(transactionId || '').trim()
  const dedupeKey = `google_ads_purchase:${tx || 'unknown'}`
  try {
    if (tx && sessionStorage.getItem(dedupeKey)) return
    if (tx) sessionStorage.setItem(dedupeKey, '1')
  } catch {
    // sessionStorage pode falhar em modo restrito; segue o disparo
  }

  const safeCurrency = currency || 'BRL'
  const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0

  const eventParams: Record<string, string | number> = {
    transaction_id: tx,
  }
  if (hasValue) {
    eventParams.value = value
    eventParams.currency = safeCurrency
  }

  // Nova conversão do assistente do Ads (PURCHASE)
  gtag('event', GOOGLE_ADS_PURCHASE_EVENT, eventParams)

  // Tag clássica send_to (legado)
  const legacyPayload: Record<string, string | number> = {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    transaction_id: tx,
  }
  if (hasValue) {
    legacyPayload.value = value
    legacyPayload.currency = safeCurrency
  }
  gtag('event', 'conversion', legacyPayload)

  // GA4 purchase padrão (ajuda a importação Ads ← GA4)
  gtag('event', 'purchase', {
    transaction_id: tx || undefined,
    ...(hasValue
      ? {
          value,
          currency: safeCurrency,
        }
      : {}),
  })
}
