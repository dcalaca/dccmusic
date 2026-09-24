import type { TFunction } from 'i18next'

const knownErrorCodes = new Set(['unauthorized', 'missingFields', 'invalidType', 'notFound', 'alreadyActive', 'createPayment'])

export function featuredPaymentError(t: TFunction, data: { errorCode?: string }, status: number) {
  const code = data.errorCode || (status === 401 ? 'unauthorized' : status === 404 ? 'notFound' : 'createPayment')
  return t(`featured.errors.${knownErrorCodes.has(code) ? code : 'createPayment'}`)
}

export function featuredPrice(locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(9.9)
}
