import { normalizeStudioLyricStructure } from './studio-lyric-normalizer'

/** Preview of the exact lyric body that the Suno endpoint prepares (before provider-specific routing). */
export function getStudioLyricPreflight(input: string) {
  const original = String(input || '').trim()
  const normalized = normalizeStudioLyricStructure(original).lyric
  const sentLyric = normalized.slice(0, 5000)
  const commentaryPatterns = [
    /(?:esse|este)\s+[ée]\s+(?:o\s+)?seu\s+refr[aã]o/i,
    /(?:eu\s+)?deixei\s+(?:ele|ela|o\s+refr[aã]o)\s+(?:com|mais|menor|curt)/i,
    /(?:s[oó]\s+)?mais\s+curt[oa]\s+e\s+forte/i,
    /(?:aqui|abaixo)\s+(?:est[aá]|segue)\s+(?:a\s+)?(?:sua\s+)?(?:letra|refr[aã]o)/i,
  ]
  const suspiciousLines = sentLyric.split('\n').map(line => line.trim())
    .filter(line => commentaryPatterns.some(pattern => pattern.test(line)))
  return {
    original,
    sentLyric,
    suspiciousLines,
    truncated: normalized.length > 5000,
    normalized: normalized !== original,
  }
}
