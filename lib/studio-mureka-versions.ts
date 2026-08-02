import { supabaseAdmin } from './supabase'
import { backupStudioVersionAudio } from './studio-audio-backup'

export const MUREKA_TRACKS_PER_GENERATION = 2

export function getMurekaChoiceAudioUrl(choice: any) {
  return choice?.url || choice?.audio_url || null
}

export function getMurekaChoiceStreamAudioUrl(choice: any) {
  return choice?.stream_url || choice?.streamAudioUrl || getMurekaChoiceAudioUrl(choice)
}

export function extractMurekaChoicesFromPayload(result: any) {
  const choices = result?.choices || result?.data?.choices
  return Array.isArray(choices) ? choices : []
}

function normalizeDurationSeconds(value: any) {
  const duration = Number(value) || 0
  if (!duration) return null
  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)
}

function choiceKey(choice: any) {
  return String(
    choice?.id ||
      getMurekaChoiceAudioUrl(choice) ||
      getMurekaChoiceStreamAudioUrl(choice) ||
      ''
  )
}

export function mergeUniqueMurekaChoices(...groups: any[][]) {
  const byKey = new Map<string, any>()
  for (const group of groups) {
    for (const choice of group || []) {
      if (!getMurekaChoiceAudioUrl(choice) && !getMurekaChoiceStreamAudioUrl(choice)) continue
      const key = choiceKey(choice)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, choice)
    }
  }
  return Array.from(byKey.values()).slice(0, MUREKA_TRACKS_PER_GENERATION)
}

export async function fetchMurekaTaskChoices(taskId: string) {
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey || !taskId) return []

  const response = await fetch(
    `https://api.mureka.ai/v1/song/query/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  )
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[Studio IA] Falha ao buscar faixas Mureka:', result)
    return []
  }
  return extractMurekaChoicesFromPayload(result)
}

function findMatchingVersion(
  existingVersions: any[],
  choice: any,
  audioUrl: string | null,
  streamAudioUrl: string | null,
  index: number,
  claimedIds: Set<string>
) {
  const available = (existingVersions || []).filter((version: any) => !claimedIds.has(version.id))

  const byId = available.find((version: any) => (
    choice?.id && version.provider_payload?.id === choice.id
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

  if (existingVersions.length >= MUREKA_TRACKS_PER_GENERATION && available[0]) {
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
    console.error('[Studio IA] Erro ao contar versões Mureka:', error)
    return 0
  }
  return count || 0
}

/**
 * Persiste choices Mureka.
 * Regra: no máximo 2. No complete, só limpa órfãos se já salvamos exatamente 2.
 */
export async function saveMurekaGenerationTracks(input: {
  generation: any
  choices: any[]
  isComplete: boolean
  model?: string | null
}) {
  const validChoices = mergeUniqueMurekaChoices(input.choices || [])

  if (validChoices.length === 0) {
    return {
      savedVersions: [] as Array<{ id: string | null; choice: any; audioUrl: string | null; streamAudioUrl: string | null }>,
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
  const savedVersions: Array<{ id: string | null; choice: any; audioUrl: string | null; streamAudioUrl: string | null }> = []
  const model =
    input.model ||
    input.generation.response_payload?.model ||
    input.generation.response_payload?.data?.model ||
    null

  for (const [index, choice] of validChoices.entries()) {
    const audioUrl = getMurekaChoiceAudioUrl(choice)
    const streamAudioUrl = getMurekaChoiceStreamAudioUrl(choice)
    const isCurrent = index === validChoices.length - 1
    const existingVersion = findMatchingVersion(
      existingVersions || [],
      choice,
      audioUrl,
      streamAudioUrl,
      index,
      claimedIds
    )

    let savedVersionId = existingVersion?.id || null
    if (savedVersionId) claimedIds.add(savedVersionId)

    const versionPayload = {
      version_name: `Música gerada #${index + 1}`,
      style: input.generation.request_payload?.prompt || null,
      audio_url: audioUrl || existingVersion?.audio_url || null,
      stream_audio_url: streamAudioUrl || existingVersion?.stream_audio_url || null,
      duration: normalizeDurationSeconds(choice.duration),
      model,
      provider_payload: choice,
      is_current: isCurrent,
      updated_at: new Date().toISOString(),
    }

    if (existingVersion) {
      await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', existingVersion.id)
    } else if ((existingVersions?.length || 0) >= MUREKA_TRACKS_PER_GENERATION) {
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
        streamAudioUrl,
        forceFullAudioUpgrade: input.isComplete && Boolean(audioUrl || versionPayload.audio_url),
      }).catch((backupError) => {
        console.error('[Studio IA] Erro no backup interno do áudio Mureka:', backupError)
      })
    }

    savedVersions.push({
      id: savedVersionId,
      choice,
      audioUrl: audioUrl || versionPayload.audio_url || null,
      streamAudioUrl,
    })
  }

  const keepIds = savedVersions.map((item) => item.id).filter(Boolean) as string[]
  const versionCount = await countGenerationVersions(input.generation.id)
  const hasExactTwo = versionCount === MUREKA_TRACKS_PER_GENERATION

  if (input.isComplete && keepIds.length === MUREKA_TRACKS_PER_GENERATION) {
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
    hasExactTwo: hasExactTwo || keepIds.length === MUREKA_TRACKS_PER_GENERATION,
  }
}

/**
 * Garante 2 faixas no complete: se o poll vier com 1, busca de novo na Mureka.
 */
export async function saveMurekaGenerationTracksEnsuringTwo(input: {
  generation: any
  choices: any[]
  isComplete: boolean
  model?: string | null
}) {
  let choices = mergeUniqueMurekaChoices(input.choices || [])

  if (input.isComplete && choices.length < MUREKA_TRACKS_PER_GENERATION && input.generation?.provider_task_id) {
    const fetched = await fetchMurekaTaskChoices(String(input.generation.provider_task_id))
    choices = mergeUniqueMurekaChoices(choices, fetched)
  }

  const result = await saveMurekaGenerationTracks({
    generation: input.generation,
    choices,
    isComplete: input.isComplete,
    model: input.model,
  })

  if (input.isComplete && !result.hasExactTwo && input.generation?.provider_task_id) {
    const fetchedAgain = await fetchMurekaTaskChoices(String(input.generation.provider_task_id))
    if (fetchedAgain.length >= MUREKA_TRACKS_PER_GENERATION) {
      return saveMurekaGenerationTracks({
        generation: input.generation,
        choices: fetchedAgain,
        isComplete: true,
        model: input.model,
      })
    }
  }

  const versionCount = await countGenerationVersions(input.generation.id)
  return {
    ...result,
    hasExactTwo: versionCount === MUREKA_TRACKS_PER_GENERATION,
    versionCount,
  }
}
