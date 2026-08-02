import { supabaseAdmin } from './supabase'
import { backupStudioVersionAudio } from './studio-audio-backup'

export const SUNO_TRACKS_PER_GENERATION = 2

export function getTrackAudioUrl(track: any) {
  return track?.audio_url || track?.audioUrl || track?.source_audio_url || track?.sourceAudioUrl || track?.url || null
}

export function getTrackStreamAudioUrl(track: any) {
  return track?.stream_audio_url || track?.streamAudioUrl || track?.source_stream_audio_url || track?.sourceStreamAudioUrl || track?.stream_url || track?.streamUrl || null
}

export function extractSunoTracksFromPayload(result: any) {
  const candidates = [
    result?.data?.response?.sunoData,
    result?.data?.response?.data,
    result?.data?.sunoData,
    result?.data?.data,
    result?.response?.sunoData,
    result?.response?.data,
    result?.sunoData,
    result?.data,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function trackKey(track: any) {
  return String(
    track?.id ||
      getTrackAudioUrl(track) ||
      getTrackStreamAudioUrl(track) ||
      ''
  )
}

export function mergeUniqueSunoTracks(...groups: any[][]) {
  const byKey = new Map<string, any>()
  for (const group of groups) {
    for (const track of group || []) {
      if (!getTrackAudioUrl(track) && !getTrackStreamAudioUrl(track)) continue
      const key = trackKey(track)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, track)
    }
  }
  return Array.from(byKey.values()).slice(0, SUNO_TRACKS_PER_GENERATION)
}

export async function fetchSunoTaskTracks(taskId: string) {
  const apiKey = process.env.SUNOAPI_KEY?.trim()
  if (!apiKey || !taskId) return []

  const response = await fetch(
    `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  )
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[Studio IA] Falha ao buscar faixas Suno:', result)
    return []
  }
  return extractSunoTracksFromPayload(result)
}

function findMatchingVersion(
  existingVersions: any[],
  track: any,
  audioUrl: string | null,
  streamAudioUrl: string | null,
  index: number,
  claimedIds: Set<string>
) {
  const available = (existingVersions || []).filter((version: any) => !claimedIds.has(version.id))

  const byId = available.find((version: any) => (
    track?.id && version.provider_payload?.id === track.id
  ))
  if (byId) return byId

  const byAudio = available.find((version: any) => (
    (audioUrl && version.audio_url === audioUrl) ||
    (streamAudioUrl && version.stream_audio_url === streamAudioUrl) ||
    (audioUrl && version.stream_audio_url === audioUrl) ||
    (streamAudioUrl && version.audio_url === streamAudioUrl)
  ))
  if (byAudio) return byAudio

  if (available[index]) return available[index]

  // Já temos 2: reutiliza sobra em vez de criar a 3ª.
  if (existingVersions.length >= SUNO_TRACKS_PER_GENERATION && available[0]) {
    return available[0]
  }

  return null
}

export async function countGenerationVersions(generationId: string) {
  const { count, error } = await supabaseAdmin
    .from('studio_versions')
    .select('id', { count: 'exact', head: true })
    .eq('generation_id', generationId)

  if (error) {
    console.error('[Studio IA] Erro ao contar versões:', error)
    return 0
  }
  return count || 0
}

/**
 * Persiste faixas Suno.
 * Regra: no máximo 2. No complete, só limpa órfãos se já salvamos exatamente 2.
 */
export async function saveSunoGenerationTracks(input: {
  generation: any
  tracks: any[]
  isComplete: boolean
}) {
  const validTracks = mergeUniqueSunoTracks(input.tracks || [])

  if (validTracks.length === 0) {
    return {
      savedVersions: [] as Array<{ id: string | null; track: any; audioUrl: string | null; streamAudioUrl: string | null }>,
      hasExactTwo: false,
    }
  }

  await supabaseAdmin
    .from('studio_versions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('project_id', input.generation.project_id)
    .eq('composer_id', input.generation.composer_id)

  const { data: existingVersions } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url, provider_payload')
    .eq('generation_id', input.generation.id)
    .order('created_at', { ascending: true })

  const claimedIds = new Set<string>()
  const savedVersions: Array<{ id: string | null; track: any; audioUrl: string | null; streamAudioUrl: string | null }> = []

  for (const [index, track] of validTracks.entries()) {
    const rawAudioUrl = getTrackAudioUrl(track)
    const rawStreamAudioUrl = getTrackStreamAudioUrl(track)
    const streamAudioUrl = rawStreamAudioUrl || null
    const audioUrl = rawAudioUrl && rawAudioUrl !== streamAudioUrl ? rawAudioUrl : null
    const playableStreamUrl = streamAudioUrl || rawAudioUrl || null
    const isCurrent = index === validTracks.length - 1
    const existingVersion = findMatchingVersion(
      existingVersions || [],
      track,
      audioUrl || playableStreamUrl,
      playableStreamUrl,
      index,
      claimedIds
    )

    let savedVersionId = existingVersion?.id || null
    if (savedVersionId) claimedIds.add(savedVersionId)

    const versionPayload = {
      version_name: `Música gerada #${index + 1}`,
      style: track.tags || null,
      audio_url: audioUrl || existingVersion?.audio_url || null,
      stream_audio_url: playableStreamUrl || existingVersion?.stream_audio_url || null,
      duration: track.duration || null,
      model: track.model_name || null,
      provider_payload: track,
      is_current: isCurrent,
      updated_at: new Date().toISOString(),
    }

    if (existingVersion) {
      await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', existingVersion.id)
    } else if ((existingVersions?.length || 0) >= SUNO_TRACKS_PER_GENERATION) {
      const fallback = (existingVersions || []).find((version: any) => !claimedIds.has(version.id))
      if (fallback) {
        savedVersionId = fallback.id
        claimedIds.add(fallback.id)
        await supabaseAdmin
          .from('studio_versions')
          .update(versionPayload)
          .eq('id', fallback.id)
      }
    } else {
      const { data: insertedVersion } = await supabaseAdmin
        .from('studio_versions')
        .insert({
          project_id: input.generation.project_id,
          composer_id: input.generation.composer_id,
          generation_id: input.generation.id,
          ...versionPayload,
        })
        .select('id')
        .maybeSingle()
      savedVersionId = insertedVersion?.id || savedVersionId
      if (savedVersionId) claimedIds.add(savedVersionId)
    }

    if (savedVersionId) {
      await backupStudioVersionAudio({
        versionId: savedVersionId,
        composerId: input.generation.composer_id,
        audioUrl: audioUrl || (input.isComplete ? versionPayload.audio_url : null),
        streamAudioUrl: playableStreamUrl,
        forceFullAudioUpgrade: input.isComplete && Boolean(audioUrl || versionPayload.audio_url),
      }).catch((backupError) => {
        console.error('[Studio IA] Erro no backup interno do áudio:', backupError)
      })
    }

    savedVersions.push({
      id: savedVersionId,
      track,
      audioUrl: audioUrl || versionPayload.audio_url || null,
      streamAudioUrl: playableStreamUrl,
    })
  }

  const keepIds = savedVersions.map((item) => item.id).filter(Boolean) as string[]
  const versionCount = await countGenerationVersions(input.generation.id)
  const hasExactTwo = versionCount === SUNO_TRACKS_PER_GENERATION

  // Só limpa órfãos quando temos exatamente 2 salvas.
  // Se o complete vier com 1 faixa, NÃO apaga a outra.
  if (input.isComplete && keepIds.length === SUNO_TRACKS_PER_GENERATION) {
    const { data: allForGeneration } = await supabaseAdmin
      .from('studio_versions')
      .select('id')
      .eq('generation_id', input.generation.id)

    const orphanIds = (allForGeneration || [])
      .map((version: any) => version.id)
      .filter((id: string) => id && !keepIds.includes(id))

    if (orphanIds.length > 0) {
      await supabaseAdmin
        .from('studio_versions')
        .delete()
        .in('id', orphanIds)
        .eq('generation_id', input.generation.id)
    }
  }

  return {
    savedVersions,
    hasExactTwo: hasExactTwo || keepIds.length === SUNO_TRACKS_PER_GENERATION,
  }
}

/**
 * Garante 2 faixas no complete: se o callback/poll vier com 1, busca de novo na Suno.
 */
export async function saveSunoGenerationTracksEnsuringTwo(input: {
  generation: any
  tracks: any[]
  isComplete: boolean
}) {
  let tracks = mergeUniqueSunoTracks(input.tracks || [])

  if (input.isComplete && tracks.length < SUNO_TRACKS_PER_GENERATION && input.generation?.provider_task_id) {
    const fetched = await fetchSunoTaskTracks(String(input.generation.provider_task_id))
    tracks = mergeUniqueSunoTracks(tracks, fetched)
  }

  // Se ainda faltam e já existem versões no banco, não força complete com 1.
  const result = await saveSunoGenerationTracks({
    generation: input.generation,
    tracks,
    isComplete: input.isComplete,
  })

  if (input.isComplete && !result.hasExactTwo && input.generation?.provider_task_id) {
    const fetchedAgain = await fetchSunoTaskTracks(String(input.generation.provider_task_id))
    if (fetchedAgain.length >= SUNO_TRACKS_PER_GENERATION) {
      return saveSunoGenerationTracks({
        generation: input.generation,
        tracks: fetchedAgain,
        isComplete: true,
      })
    }
  }

  const versionCount = await countGenerationVersions(input.generation.id)
  return {
    ...result,
    hasExactTwo: versionCount === SUNO_TRACKS_PER_GENERATION,
    versionCount,
  }
}
