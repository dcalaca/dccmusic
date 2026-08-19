export type DccCountry = 'BR' | 'PY'
export type DccLocale = 'pt-BR' | 'es-PY'

export const DEFAULT_COUNTRY: DccCountry = 'BR'
export const DEFAULT_LOCALE: DccLocale = 'pt-BR'

export const COUNTRY_COOKIE = 'dcc_country'

export const COUNTRY_CONFIG: Record<DccCountry, {
  country: DccCountry
  locale: DccLocale
  currency: 'BRL' | 'PYG'
  label: string
  flag: string
  paymentProvider: 'mercadopago' | 'stripe'
}> = {
  BR: {
    country: 'BR',
    locale: 'pt-BR',
    currency: 'BRL',
    label: 'Brasil',
    flag: '🇧🇷',
    paymentProvider: 'mercadopago',
  },
  PY: {
    country: 'PY',
    locale: 'es-PY',
    currency: 'PYG',
    label: 'Paraguay',
    flag: '🇵🇾',
    paymentProvider: 'stripe',
  },
}

export function normalizeCountry(value?: string | null): DccCountry {
  return String(value || '').toUpperCase() === 'PY' ? 'PY' : 'BR'
}

export function getLocaleForCountry(country: DccCountry): DccLocale {
  return COUNTRY_CONFIG[country].locale
}

// Cotação de referência usada apenas para antecipar o preço no site.
// O valor definitivo em PYG é apresentado pelo Adaptive Pricing do Stripe.
export const BRL_TO_PYG_DISPLAY_RATE = 1160

export function brlToPygDisplay(value: number) {
  const converted = Math.max(0, Number(value) || 0) * BRL_TO_PYG_DISPLAY_RATE
  return Math.round(converted / 100) * 100
}

export function formatLocalizedMoney(valueInBrl: number, country: DccCountry) {
  if (country === 'PY') {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0,
    }).format(brlToPygDisplay(valueInBrl))
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInBrl)
}

