export function isMercadoPagoInSiteCheckoutEnabled() {
  if (!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) return false
  if (process.env.NEXT_PUBLIC_MP_IN_SITE_CHECKOUT === '0') return false
  if (process.env.NEXT_PUBLIC_MP_IN_SITE_CHECKOUT === '1') return true

  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')
}

export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''
}
