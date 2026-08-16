export function getStudioVideoAudioId(version: any, generation: any): string | null {
  const fromVersion =
    version?.provider_payload?.id ||
    version?.provider_payload?.audio_id ||
    version?.provider_payload?.audioId ||
    null
  if (fromVersion) return String(fromVersion)
  if (generation?.provider_audio_id) return String(generation.provider_audio_id)
  return null
}

function collectTrackUrls(generation: any, version?: any) {
  return [
    version?.audio_url,
    version?.stream_audio_url,
    version?.provider_payload?.url,
    version?.provider_payload?.audio_url,
    generation?.request_payload?.url,
  ].map((value) => String(value || ''))
}

export function isMurekaStudioTrack(generation: any, version?: any): boolean {
  if (String(generation?.provider || '').toLowerCase() === 'mureka') return true
  return collectTrackUrls(generation, version).some((url) => url.includes('mureka.ai'))
}

export function getStudioVersionDurationMs(version: any): number | null {
  const value = Number(version?.provider_payload?.duration || version?.duration || 0)
  if (!Number.isFinite(value) || value <= 0) return null
  return value > 1000 ? Math.round(value) : Math.round(value * 1000)
}

export function buildMurekaLyricsVideoPayload(input: {
  songId: string
  title: string
  coverUrl?: string | null
  durationMs?: number | null
}) {
  const coverUrl = String(input.coverUrl || '').trim()
  const payload: Record<string, any> = {
    song_id: String(input.songId),
    title: String(input.title || 'DCC Music').slice(0, 80),
    aspect_ratio: '9:16',
    layout: coverUrl ? 'layout_2' : 'layout_1',
  }

  if (coverUrl) payload.cover = coverUrl

  const durationMs = Number(input.durationMs || 0)
  if (durationMs > 1000) {
    payload.selection_start = 0
    payload.selection_end = durationMs
  }

  return payload
}

export function extractMurekaLyricsVideoUrl(result: any): string | null {
  const url =
    result?.url ||
    result?.data?.url ||
    result?.video_url ||
    result?.data?.video_url ||
    result?.videoUrl ||
    result?.data?.videoUrl ||
    null
  return url ? String(url) : null
}

export function isSunoRecordMissingError(result: any): boolean {
  const message = String(result?.msg || result?.message || result?.error?.message || '').toLowerCase()
  return message.includes('record does not exist')
}

export function translateStudioVideoProviderError(message?: string | null, fallback?: string): string {
  const raw = String(message || '').trim()
  const fallbackMessage = fallback || 'Não consegui iniciar a geração do vídeo com letra agora.'
  if (!raw) return fallbackMessage

  const normalized = raw.toLowerCase()
  if (normalized.includes('record does not exist')) {
    return 'Esta música foi criada em outro estúdio de IA. O vídeo com letra precisa ser gerado por esse estúdio, não pela Suno.'
  }
  if (normalized.includes('insufficient') || normalized.includes('credit')) {
    return 'A geradora de vídeo está sem créditos no momento. Tente de novo em instantes.'
  }

  return raw
}
