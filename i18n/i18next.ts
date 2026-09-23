import { createInstance, type i18n, type InitOptions } from 'i18next'
import { defaultLocale, normalizeLocale, type AppLocale } from './config'

import ptBR from './messages/pt-BR.json'
import ptPT from './messages/pt-PT.json'
import enUS from './messages/en-US.json'
import enGB from './messages/en-GB.json'
import esES from './messages/es-ES.json'
import esMX from './messages/es-MX.json'
import esCO from './messages/es-CO.json'
import esPY from './messages/es-PY.json'

export const translationNamespace = 'translation' as const

export const i18nResources = {
  'pt-BR': { [translationNamespace]: ptBR },
  'pt-PT': { [translationNamespace]: ptPT },
  'en-US': { [translationNamespace]: enUS },
  'en-GB': { [translationNamespace]: enGB },
  'es-ES': { [translationNamespace]: esES },
  'es-MX': { [translationNamespace]: esMX },
  'es-CO': { [translationNamespace]: esCO },
  'es-PY': { [translationNamespace]: esPY },
} as const

export function getI18nOptions(locale?: string | null): InitOptions {
  const normalizedLocale = normalizeLocale(locale)

  return {
    resources: i18nResources,
    lng: normalizedLocale,
    fallbackLng: defaultLocale,
    initAsync: false,
    supportedLngs: Object.keys(i18nResources),
    defaultNS: translationNamespace,
    ns: [translationNamespace],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  }
}

export async function createDccI18n(locale: AppLocale | string = defaultLocale): Promise<i18n> {
  const instance = createInstance()

  await instance.init(getI18nOptions(locale))

  return instance
}
