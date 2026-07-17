export const STUDIO_EXTRA_STYLES = ['Trap'] as const

export function normalizeStudioStyleName(style?: string | null) {
  return String(style || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isMurekaFirstStyle(style?: string | null) {
  const normalized = normalizeStudioStyleName(style)
  return normalized === 'trap'
}

export function getMurekaFirstStylePrompt(style?: string | null) {
  if (normalizeStudioStyleName(style) === 'trap') {
    return 'melodic trap, smooth singing, emotional, autotune, studio production, lento, romantico'
  }
  return null
}
