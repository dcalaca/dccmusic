'use client'

/** Conta Google Ads (tag global). */
const GOOGLE_ADS_ID = 'AW-16698092699'

/** Tag antiga (ainda válida se a ação existir no Ads). */
const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-16698092699/uJPVCL7Ew9EZEJvZopo-'

/** Evento da ação PURCHASE do assistente do Google Ads. */
const GOOGLE_ADS_PURCHASE_EVENT = 'conversion_event_purchase'

type PurchaseTrackInput = {
  transactionId?: string | null
  value?: number
  currency?: string | null
}

function getGtag(): ((...args: any[]) => void) | null {
  if (typeof window === 'undefined') return null
  const gtag = (window as any).gtag
  return typeof gtag === 'function' ? gtag : null
}

function ensureGtagStub() {
  if (typeof window === 'undefined') return
  const w = window as any
  w.dataLayer = w.dataLayer || []
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtag() {
      w.dataLayer.push(arguments)
    }
  }
}

function waitForGtag(timeoutMs = 8000): Promise<(...args: any[]) => void> {
  ensureGtagStub()
  const existing = getGtag()
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      const gtag = getGtag()
      if (gtag || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer)
        ensureGtagStub()
        resolve(getGtag() || ((...args: any[]) => {
          ;(window as any).dataLayer.push(args)
        }))
      }
    }, 100)
  })
}

function firePurchaseEvents(
  gtag: (...args: any[]) => void,
  {
    transactionId,
    value,
    currency = 'BRL',
  }: PurchaseTrackInput
) {
  const tx = String(transactionId || '').trim()
  const safeCurrency = currency || 'BRL'
  const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0

  const eventParams: Record<string, string | number> = {
    send_to: GOOGLE_ADS_ID,
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

  // GA4 purchase padrão (importação Ads ← GA4)
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

/**
 * Dispara conversão de compra para Google Ads + evento purchase do GA4.
 * Deduplica por transactionId na sessão e espera o gtag carregar.
 */
export function trackGoogleAdsPurchaseConversion(input: PurchaseTrackInput) {
  if (typeof window === 'undefined') return

  const tx = String(input.transactionId || '').trim()
  const dedupeKey = `google_ads_purchase:${tx || 'unknown'}`
  try {
    if (tx && sessionStorage.getItem(dedupeKey)) return
  } catch {
    // sessionStorage pode falhar em modo restrito; segue o disparo
  }

  void waitForGtag().then((gtag) => {
    try {
      if (tx && sessionStorage.getItem(dedupeKey)) return
      if (tx) sessionStorage.setItem(dedupeKey, '1')
    } catch {
      // ignore
    }
    firePurchaseEvents(gtag, input)
  })
}
