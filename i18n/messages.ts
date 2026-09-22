import type { AppLocale } from './config'

export type Messages = Record<string, unknown>

const loaders: Record<AppLocale, () => Promise<Messages>> = {
  'pt-BR': async () => (await import('./messages/pt-BR.json')).default,
  'pt-PT': async () => (await import('./messages/pt-PT.json')).default,
  'en-US': async () => (await import('./messages/en-US.json')).default,
  'en-GB': async () => (await import('./messages/en-GB.json')).default,
  'es-ES': async () => (await import('./messages/es-ES.json')).default,
  'es-MX': async () => (await import('./messages/es-MX.json')).default,
  'es-CO': async () => (await import('./messages/es-CO.json')).default,
  'es-PY': async () => (await import('./messages/es-PY.json')).default,
}

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  return loaders[locale]()
}
