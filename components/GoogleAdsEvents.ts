'use client'

const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-16698092699/uJPVCL7Ew9EZEJvZopo-'

export function trackGoogleAdsPurchaseConversion({
  transactionId,
  value,
  currency = 'BRL',
}: {
  transactionId?: string | null
  value?: number
  currency?: string | null
}) {
  if (typeof window === 'undefined') return

  const gtag = (window as any).gtag
  if (typeof gtag !== 'function') return

  const payload: Record<string, string | number> = {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    transaction_id: transactionId || '',
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    payload.value = value
    payload.currency = currency || 'BRL'
  }

  gtag('event', 'conversion', payload)
}
