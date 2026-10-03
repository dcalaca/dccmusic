// Provider instructions stay independent of the UI language and saved genre value.
export function isSambaCancao(style?: string | null) {
  const normalized = String(style || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return /\bsamba[\s_-]+cancao\b/.test(normalized)
}

export function getStudioGenreDirection(style?: string | null) {
  if (!isSambaCancao(style)) return String(style || '').trim()
  return `${String(style || '').trim()}, samba-canção brasileiro clássico, Brazilian samba-canção romantic ballad, slow relaxed tempo, lyrical expressive melody, intimate emotional phrasing, rich romantic harmony, gentle restrained samba syncopation, subtle percussion, song-led arrangement; preserve samba-canção throughout, never upbeat carnival samba or pagode`
}

export function getStudioGenreNegativeTags(style?: string | null) {
  return isSambaCancao(style)
    ? ['samba-enredo', 'carnival samba', 'fast samba', 'party samba', 'pagode', 'batucada', 'driving percussion']
    : []
}
