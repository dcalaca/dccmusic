export function studioVideoErrorCode(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (!normalized) return null

  if (normalized.includes('temporariamente indisponível') || normalized.includes('temporarily unavailable')) return 'temporarilyUnavailable'
  if (normalized.includes('outro estúdio') || normalized.includes('another studio')) return 'providerMismatch'
  if (normalized.includes('não foi encontrada neste projeto') || normalized.includes('não encontrada neste projeto')) return 'versionNotFound'
  if (normalized.includes('não consegui recuperar o link') || normalized.includes('renovar o vídeo')) return 'recovery'
  if (normalized.includes('substituída por uma nova tentativa')) return 'replaced'
  return 'failed'
}
