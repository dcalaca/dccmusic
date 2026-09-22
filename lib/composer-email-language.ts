export type ComposerEmailLanguage = 'pt' | 'en' | 'es'

export function getComposerEmailLanguage(country?: string | null): ComposerEmailLanguage {
  const normalizedCountry = String(country || '').trim().toUpperCase()

  if (['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA'].includes(normalizedCountry)) return 'en'
  if (['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE'].includes(normalizedCountry)) return 'es'
  return 'pt'
}
