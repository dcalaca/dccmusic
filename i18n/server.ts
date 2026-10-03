import { headers } from 'next/headers'
import { isSupportedLocale, defaultLocale } from './config'
import { createDccI18n as createI18n } from './i18next'

/** Server-rendered copy follows the chosen language, independently of pricing country. */
export function createDccI18n(fallbackLocale: string = defaultLocale) {
  const preferredLocale = headers().get('x-dcc-locale')
  return createI18n(isSupportedLocale(preferredLocale) ? preferredLocale : fallbackLocale)
}
