import { translateToParaguayanSpanish } from '@/lib/i18n-es-py'

const exact: Record<string, string> = {
  'Ingresar': 'Iniciar sesión',
  'Ingresando...': 'Iniciando sesión...',
  'Acceso para compositores': 'Inicio de sesión para compositores',
}

const replacements: Array<[RegExp, string]> = [
  [/\bPulsa\b/g, 'Haz clic'],
  [/\bpulsa\b/g, 'haz clic'],
]

/**
 * Usa a tradução latino-americana existente como base e aplica somente os
 * ajustes de vocabulário necessários para soar natural no México.
 */
export function translateToMexicanSpanish(value: string) {
  const translated = translateToParaguayanSpanish(value)
  if (Object.prototype.hasOwnProperty.call(exact, translated)) return exact[translated]
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), translated)
}
