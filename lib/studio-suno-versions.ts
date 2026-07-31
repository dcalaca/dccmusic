import { supabaseAdmin } from './supabase'
import { backupStudioVersionAudio } from './studio-audio-backup'

export function getTrackAudioUrl(track: any) {
  return track?.audio_url || track?.audioUrl || track?.source_audio_url || track?.sourceAudioUrl || track?.url || null
}

export function getTrackStreamAudioUrl(track: any) {
  return track?.stream_audio_url || track?.streamAudioUrl || track?.source_stream_audio_url || track?.sourceStreamAudioUrl || track?.stream_url || track?.streamUrl || null
}

function findMatchingVersion(
  existingVersions: any[],
  track: any,
  audioUrl: string | null,
  streamAudioUrl: string | null,
  index: number,
  claimedIds: Set<string>
) {
  const byId = (existingVersions || []).find((version: any) => (
    !claimedIds.has(version.id) &&
    track?.id &&
    version.provider_payload?.id === track.id
  ))
  if (byId) return byId

  const byAudio = (existingVersions || []).find((version: any) => (
    !claimedIds.has(version.id) &&
    ((audioUrl && version.audio_url === audioUrl) ||
      (streamAudioUrl && version.stream_audio_url === streamAudioUrl) ||
      (audioUrl && version.stream_audio_url === audioUrl) ||
      (streamAudioUrl && version.audio_url === streamAudioUrl))
  ))
  if (byAudio) return byAudio

  // Fallback: mesma posição na geração (evita "3 músicas" quando o callback first
  // salvou stream sem id estável e o complete chega com URLs novas).
  const byIndex = (existingVersions || [])[index]
  if (byIndex && !claimedIds.has(byIndex.id)) return byIndex

  return null
}

export async function saveSunoGenerationTracks(input: {
  generation: any
  tracks: any[]
  isComplete: boolean
}) {
  const validTracks = (input.tracks || []).filter((track) => (
    getTrackAudioUrl(track) || getTrackStreamAudioUrl(track)
  ))

  if (validTracks.length === 0) return []

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
    const audioUrl = getTrackAudioUrl(track)
    const streamAudioUrl = getTrackStreamAudioUrl(track)
    const isCurrent = index === validTracks.length - 1
    const existingVersion = findMatchingVersion(
      existingVersions || [],
      track,
      audioUrl,
      streamAudioUrl,
      index,
      claimedIds
    )

    let savedVersionId = existingVersion?.id || null
    if (savedVersionId) claimedIds.add(savedVersionId)

    const versionPayload = {
      version_name: validTracks.length > 1 ? `Música gerada #${index + 1}` : (track.tags || 'Versão IA'),
      style: track.tags || null,
      audio_url: audioUrl,
      stream_audio_url: streamAudioUrl,
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
        audioUrl,
        streamAudioUrl,
      }).catch((backupError) => {
        console.error('[Studio IA] Erro no backup interno do áudio:', backupError)
      })
    }

    savedVersions.push({ id: savedVersionId, track, audioUrl, streamAudioUrl })
  }

  // No complete, remove versões órfãs da mesma geração (ex.: stream parcial do first sem match).
  if (input.isComplete) {
    const keepIds = savedVersions.map((item) => item.id).filter(Boolean) as string[]
    const orphanIds = (existingVersions || [])
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

  return savedVersions
}
