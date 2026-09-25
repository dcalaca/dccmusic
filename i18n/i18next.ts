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
import { studioAudioMessages } from './studio-audio-messages'
import { studioVideoMessages } from './studio-video-messages'

export const translationNamespace = 'translation' as const

function withStudioMessages(messages: any, locale: keyof typeof studioAudioMessages) {
  return {
    ...messages,
    studio: {
      ...messages.studio,
      project: {
        ...messages.studio.project,
        audio: { ...messages.studio.project.audio, ...studioAudioMessages[locale] },
        video: { ...messages.studio.project.video, ...studioVideoMessages[locale] },
      },
    },
  }
}

export const i18nResources = {
  'pt-BR': { [translationNamespace]: withStudioMessages(ptBR, 'pt-BR') },
  'pt-PT': { [translationNamespace]: withStudioMessages(ptPT, 'pt-PT') },
  'en-US': { [translationNamespace]: withStudioMessages(enUS, 'en-US') },
  'en-GB': { [translationNamespace]: withStudioMessages(enGB, 'en-GB') },
  'es-ES': { [translationNamespace]: withStudioMessages(esES, 'es-ES') },
  'es-MX': { [translationNamespace]: withStudioMessages(esMX, 'es-MX') },
  'es-CO': { [translationNamespace]: withStudioMessages(esCO, 'es-CO') },
  'es-PY': { [translationNamespace]: withStudioMessages(esPY, 'es-PY') },
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
