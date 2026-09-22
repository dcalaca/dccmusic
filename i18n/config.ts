export const supportedLocales = [
  'pt-BR',
  'pt-PT',
  'en-US',
  'en-GB',
  'es-ES',
  'es-MX',
  'es-CO',
  'es-PY',
] as const

export type AppLocale = (typeof supportedLocales)[number]

export const defaultLocale: AppLocale = 'pt-BR'

export const localeLabels: Record<AppLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'en-US': 'English (United States)',
  'en-GB': 'English (United Kingdom)',
  'es-ES': 'Español (España)',
  'es-MX': 'Español (México)',
  'es-CO': 'Español (Colombia)',
  'es-PY': 'Español (Paraguay)',
}

export const countryToLocale = {
  BR: 'pt-BR',
  PT: 'pt-PT',
  US: 'en-US',
  UK: 'en-GB',
  GB: 'en-GB',
  ES: 'es-ES',
  MX: 'es-MX',
  CO: 'es-CO',
  PY: 'es-PY',
} as const satisfies Record<string, AppLocale>

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (supportedLocales as readonly string[]).includes(value)
}

export function normalizeLocale(value?: string | null): AppLocale {
  if (!value) return defaultLocale
  if (isSupportedLocale(value)) return value

  const normalized = value.trim().replace('_', '-')
  const lower = normalized.toLowerCase()

  if (lower === 'pt' || lower.startsWith('pt-br')) return 'pt-BR'
  if (lower.startsWith('pt-pt')) return 'pt-PT'
  if (lower === 'en' || lower.startsWith('en-us')) return 'en-US'
  if (lower.startsWith('en-gb') || lower.startsWith('en-uk')) return 'en-GB'
  if (lower === 'es' || lower.startsWith('es-es')) return 'es-ES'
  if (lower.startsWith('es-mx')) return 'es-MX'
  if (lower.startsWith('es-co')) return 'es-CO'
  if (lower.startsWith('es-py')) return 'es-PY'

  return defaultLocale
}
