import { supabaseAdmin } from './supabase'

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

function isMurekaLiveStreamUrl(value?: string | null) {
  return String(value || '').includes('/v1/live/stream/')
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

  try {
    const response = await fetch(
      `https://api.mureka.ai/v1/song/query/${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      }
    )
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      console.warn('[Studio IA] Falha ao buscar faixas Mureka:', result)
      return []
    }
    return extractMurekaChoicesFromPayload(result)
  } catch (error) {
    console.warn('[Studio IA] Timeout/rede ao consultar faixas Mureka:', error)
    return []
  }
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
 * Persiste no máximo duas faixas do Mureka.
 * O request/callback só registra o áudio; a cópia durável é feita pelo cron.
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
    .select('id, audio_url, stream_audio_url, audio_path, stream_audio_path, audio_storage_provider, stream_audio_storage_provider, audio_backup_status, provider_payload')
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
    const choiceAudioUrl = getMurekaChoiceAudioUrl(choice)
    const choiceStreamAudioUrl = getMurekaChoiceStreamAudioUrl(choice)
    const audioUrl = choiceAudioUrl || null
    // Depois de concluída a música, não precisamos manter o live stream expirável.
    const streamAudioUrl = input.isComplete && audioUrl ? audioUrl : choiceStreamAudioUrl
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

    const finalAudioUrl = audioUrl || existingVersion?.audio_url || null
    const oldWasLiveStream = isMurekaLiveStreamUrl(existingVersion?.audio_url)
    const sourceChanged = Boolean(
      finalAudioUrl && existingVersion?.audio_url && finalAudioUrl !== existingVersion.audio_url
    ) || oldWasLiveStream
    const alreadyBackedUp = Boolean(
      input.isComplete &&
      existingVersion?.audio_backup_status === 'backed_up' &&
      existingVersion?.audio_path &&
      !sourceChanged
    )

    const backupState = input.isComplete
      ? alreadyBackedUp
        ? {}
        : {
            audio_backup_status: 'pending',
            audio_backup_error: null,
            ...(sourceChanged ? {
              audio_path: null,
              stream_audio_path: null,
              audio_storage_provider: null,
              stream_audio_storage_provider: null,
            } : {}),
          }
      : {
          // Não faça backup de live stream parcial; aguarde o resultado final.
          audio_backup_status: null,
          audio_backup_error: null,
        }

    const versionPayload = {
      version_name: `Música gerada #${index + 1}`,
      style: input.generation.request_payload?.prompt || null,
      audio_url: finalAudioUrl,
      stream_audio_url: streamAudioUrl || existingVersion?.stream_audio_url || finalAudioUrl,
      duration: normalizeDurationSeconds(choice.duration),
      model,
      provider_payload: choice,
      is_current: isCurrent,
      ...backupState,
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

    savedVersions.push({
      id: savedVersionId,
      choice,
      audioUrl: finalAudioUrl,
      streamAudioUrl: streamAudioUrl || finalAudioUrl,
    })
  }

  const keepIds = savedVersions.map((item) => item.id).filter(Boolean) as string[]

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

  const versionCount = await countGenerationVersions(input.generation.id)
  return {
    savedVersions,
    hasExactTwo: versionCount === MUREKA_TRACKS_PER_GENERATION || keepIds.length === MUREKA_TRACKS_PER_GENERATION,
  }
}

/** Garante duas faixas no complete: se o poll vier com uma, consulta o Mureka novamente. */
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