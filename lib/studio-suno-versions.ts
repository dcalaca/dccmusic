import { supabaseAdmin } from './supabase'
import { backupStudioVersionAudio } from './studio-audio-backup'

const MAX_TRACKS_PER_GENERATION = 2

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

  // Mesma posição na geração.
  if (available[index]) return available[index]

  // Se já existem faixas o suficiente, reutiliza qualquer sobra em vez de criar a 3ª.
  if (existingVersions.length >= MAX_TRACKS_PER_GENERATION && available[0]) {
    return available[0]
  }

  return null
}

export async function saveSunoGenerationTracks(input: {
  generation: any
  tracks: any[]
  isComplete: boolean
}) {
  const validTracks = (input.tracks || [])
    .filter((track) => getTrackAudioUrl(track) || getTrackStreamAudioUrl(track))
    .slice(0, MAX_TRACKS_PER_GENERATION)

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
    const rawAudioUrl = getTrackAudioUrl(track)
    const rawStreamAudioUrl = getTrackStreamAudioUrl(track)
    // No callback "first", a Suno às vezes coloca o stream em audio_url.
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
      version_name: validTracks.length > 1 ? `Música gerada #${index + 1}` : (track.tags || 'Versão IA'),
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
    } else if ((existingVersions?.length || 0) >= MAX_TRACKS_PER_GENERATION) {
      // Corrida callback + polling: nunca cria a 3ª faixa.
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

  // Só limpa sobras no lote FINAL (complete/SUCCESS).
  // Callbacks "first" / FIRST_SUCCESS costumam chegar com 1 faixa e, se apagarem
  // órfãos aqui, removem a 2ª versão que o polling/complete já tinha salvo.
  if (input.isComplete && keepIds.length > 0) {
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

  return savedVersions
}
