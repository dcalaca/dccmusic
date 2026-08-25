export type DccCountry = 'BR' | 'PY' | 'CO' | 'PT' | 'MX'
export type DccLocale = 'pt-BR' | 'es-PY' | 'es-CO' | 'pt-PT' | 'es-MX'

export const DEFAULT_COUNTRY: DccCountry = 'BR'
export const DEFAULT_LOCALE: DccLocale = 'pt-BR'

export const COUNTRY_COOKIE = 'dcc_country'

export const COUNTRY_CONFIG: Record<DccCountry, {
  country: DccCountry
  locale: DccLocale
  currency: 'BRL' | 'PYG' | 'COP' | 'EUR' | 'MXN'
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
  CO: {
    country: 'CO',
    locale: 'es-CO',
    currency: 'COP',
    label: 'Colombia',
    flag: '🇨🇴',
    paymentProvider: 'stripe',
  },
  PT: {
    country: 'PT',
    locale: 'pt-PT',
    currency: 'EUR',
    label: 'Portugal',
    flag: '🇵🇹',
    paymentProvider: 'stripe',
  },
  MX: {
    country: 'MX',
    locale: 'es-MX',
    currency: 'MXN',
    label: 'México',
    flag: '🇲🇽',
    paymentProvider: 'stripe',
  },
}

export function normalizeCountry(value?: string | null): DccCountry {
  const normalized = String(value || '').toUpperCase()
  return normalized === 'PY' || normalized === 'CO' || normalized === 'PT' || normalized === 'MX' ? normalized : 'BR'
}

/** Detect the signup country from trusted hosting/proxy geolocation headers. */
export function getDetectedCountry(headers: Pick<Headers, 'get'>): string {
  const candidates = [
    headers.get('x-vercel-ip-country'),
    headers.get('cf-ipcountry'),
    headers.get('x-dcc-country'),
  ]

  for (const candidate of candidates) {
    const country = String(candidate || '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(country) && country !== 'XX') {
      return country
    }
  }

  return DEFAULT_COUNTRY
}

export function getLocaleForCountry(country: DccCountry): DccLocale {
  return COUNTRY_CONFIG[country].locale
}

// Cotações de referência usadas apenas para antecipar o preço no site.
// O valor definitivo nas moedas locais é apresentado pelo Adaptive Pricing do Stripe.
export const BRL_TO_PYG_DISPLAY_RATE = 1160
export const BRL_TO_COP_DISPLAY_RATE = 590
export const BRL_TO_EUR_DISPLAY_RATE = 0.1662
export const BRL_TO_MXN_DISPLAY_RATE = 3.29

export function brlToPygDisplay(value: number) {
  const converted = Math.max(0, Number(value) || 0) * BRL_TO_PYG_DISPLAY_RATE
  return Math.round(converted / 100) * 100
}

export function brlToCopDisplay(value: number) {
  const converted = Math.max(0, Number(value) || 0) * BRL_TO_COP_DISPLAY_RATE
  return Math.round(converted / 100) * 100
}

export function brlToEurDisplay(value: number) {
  const converted = Math.max(0, Number(value) || 0) * BRL_TO_EUR_DISPLAY_RATE
  return Math.round(converted * 100) / 100
}

export function brlToMxnDisplay(value: number) {
  const converted = Math.max(0, Number(value) || 0) * BRL_TO_MXN_DISPLAY_RATE
  return Math.round(converted * 100) / 100
}

export function formatLocalizedMoney(valueInBrl: number, country: DccCountry) {
  if (country === 'PY') {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0,
    }).format(brlToPygDisplay(valueInBrl))
  }

  if (country === 'CO') {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(brlToCopDisplay(valueInBrl))
  }

  if (country === 'PT') {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(brlToEurDisplay(valueInBrl))
  }

  if (country === 'MX') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(brlToMxnDisplay(valueInBrl))
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInBrl)
}
