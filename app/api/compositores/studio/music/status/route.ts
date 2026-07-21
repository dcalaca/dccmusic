import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { backupStudioVersionAudio, getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { getStudioGenerationProviderError, markExpiredVoiceFromGeneration } from '@/lib/studio-voice-expiration'
import {
  getStudioMusicGenerationFailureMessage,
  isStudioGenerationTimedOut,
  markStudioGenerationAsCommunicationFailure,
  releaseStudioProjectFromFailedGeneration,
  STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
} from '@/lib/studio-generation-timeout'

export const dynamic = 'force-dynamic'

function getSunoTracks(result: any) {
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

function getMurekaChoices(result: any) {
  const choices = result?.choices || result?.data?.choices
  return Array.isArray(choices) ? choices : []
}

function getTrackAudioUrl(track: any) {
  return track?.audio_url || track?.audioUrl || track?.source_audio_url || track?.sourceAudioUrl || track?.url || null
}

function getTrackStreamAudioUrl(track: any) {
  return track?.stream_audio_url || track?.streamAudioUrl || track?.source_stream_audio_url || track?.sourceStreamAudioUrl || track?.stream_url || track?.streamUrl || null
}

function normalizeDurationSeconds(value: any) {
  const duration = Number(value) || 0
  if (!duration) return null
  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)
}

async function notifyMusicReady(generation: any) {
  const [{ data: project }, composer] = await Promise.all([
    supabaseAdmin
      .from('studio_projects')
      .select('id, title')
      .eq('id', generation.project_id)
      .maybeSingle(),
    getComposerEmailIdentity(generation.composer_id),
  ])

  if (project && composer) {
    await sendStudioMusicReadyEmail({
      ...composer,
      projectId: project.id,
      projectTitle: project.title || 'Sua música',
    }).catch((emailError) => {
      console.error('[Studio IA] Erro ao enviar e-mail de música pronta:', emailError)
    })
  }
}

async function backupVersionAudio(versionId: string | null | undefined, generation: any, audioUrl: string | null, streamAudioUrl: string | null) {
  if (!versionId) return
  await backupStudioVersionAudio({
    versionId,
    composerId: generation.composer_id,
    audioUrl,
    streamAudioUrl,
  }).catch((backupError) => {
    console.error('[Studio IA] Erro no backup interno do áudio:', backupError)
  })
}

async function saveSunoTrack(generation: any, sunoData: any[], status: string) {
  const validTracks = (sunoData || []).filter((track) => (
    getTrackAudioUrl(track) || getTrackStreamAudioUrl(track)
  ))
  if (validTracks.length === 0) return

  const isComplete = status === 'SUCCESS'

  await supabaseAdmin
    .from('studio_versions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('project_id', generation.project_id)
    .eq('composer_id', generation.composer_id)

  const { data: existingVersion } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url, provider_payload')
    .eq('generation_id', generation.id)

  const savedVersions: Array<{ id: string | null; track: any }> = []

  for (const [index, track] of validTracks.entries()) {
    const audioUrl = getTrackAudioUrl(track)
    const streamAudioUrl = getTrackStreamAudioUrl(track)
    const isCurrent = index === validTracks.length - 1
    const matchingVersion = (existingVersion || []).find((version: any) => (
      (track?.id && version.provider_payload?.id === track.id) ||
      (audioUrl && version.audio_url === audioUrl) ||
      (streamAudioUrl && version.stream_audio_url === streamAudioUrl)
    ))

    let savedVersionId = matchingVersion?.id || null
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

    if (matchingVersion) {
      await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', matchingVersion.id)
    } else {
      const { data: insertedVersion } = await supabaseAdmin
        .from('studio_versions')
        .insert({
          project_id: generation.project_id,
          composer_id: generation.composer_id,
          generation_id: generation.id,
          ...versionPayload,
        })
        .select('id')
        .maybeSingle()
      savedVersionId = insertedVersion?.id || savedVersionId
    }

    await backupVersionAudio(savedVersionId, generation, audioUrl, streamAudioUrl)
    savedVersions.push({ id: savedVersionId, track })
  }

  const currentTrack = savedVersions[savedVersions.length - 1]?.track

  if (currentTrack?.image_url || currentTrack?.imageUrl || currentTrack?.source_image_url) {
    await supabaseAdmin
      .from('studio_covers')
      .update({ is_current: false })
      .eq('project_id', generation.project_id)
      .eq('composer_id', generation.composer_id)

    await supabaseAdmin
      .from('studio_covers')
      .insert({
        project_id: generation.project_id,
        composer_id: generation.composer_id,
        provider: 'sunoapi',
        image_url: currentTrack.image_url || currentTrack.imageUrl || currentTrack.source_image_url,
        is_premium: false,
        is_current: true,
      })
  }

  await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentTrack?.id || null,
        status: isComplete ? 'completed' : 'first_ready',
        response_payload: { ...(generation.response_payload || {}), sunoData },
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: isComplete ? 'ready' : 'generating', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  if (isComplete) {
    const { data: project } = await supabaseAdmin
      .from('studio_projects')
      .select('id, title, style, mood, description')
      .eq('id', generation.project_id)
      .maybeSingle()

    if (project) {
      await ensureSimpleStudioCover({
        projectId: project.id,
        composerId: generation.composer_id,
        title: project.title || 'Sua música',
        style: project.style,
        mood: project.mood,
        description: project.description,
        replaceCurrent: true,
      }).catch((coverError) => {
        console.error('[Studio IA] Erro ao criar capa simples:', coverError)
      })
    }

    await notifyMusicReady(generation)
  }
}

async function saveMurekaTrack(generation: any, choices: any[], status: string) {
  const validChoices = (choices || []).filter((choice) => (
    choice?.url || choice?.audio_url || choice?.stream_url || choice?.streamAudioUrl
  ))
  if (validChoices.length === 0) return

  const isComplete = status === 'succeeded'

  await supabaseAdmin
    .from('studio_versions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('project_id', generation.project_id)
    .eq('composer_id', generation.composer_id)

  const { data: existingVersions } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url, provider_payload')
    .eq('generation_id', generation.id)

  const savedVersions: Array<{ id: string | null; choice: any }> = []

  for (const [index, choice] of validChoices.entries()) {
    const audioUrl = choice.url || choice.audio_url || null
    const streamAudioUrl = choice.stream_url || choice.streamAudioUrl || audioUrl
    const isCurrent = index === validChoices.length - 1
    const matchingVersion = (existingVersions || []).find((version: any) => (
      (choice?.id && version.provider_payload?.id === choice.id) ||
      (audioUrl && version.audio_url === audioUrl) ||
      (streamAudioUrl && version.stream_audio_url === streamAudioUrl)
    ))

    const versionPayload = {
      audio_url: audioUrl,
      stream_audio_url: streamAudioUrl,
      duration: normalizeDurationSeconds(choice.duration),
      model: generation.response_payload?.model || generation.response_payload?.data?.model || null,
      provider_payload: choice,
      is_current: isCurrent,
      updated_at: new Date().toISOString(),
    }

    let savedVersionId = matchingVersion?.id || null

    if (!matchingVersion) {
      const { data: insertedVersion } = await supabaseAdmin
        .from('studio_versions')
        .insert({
          project_id: generation.project_id,
          composer_id: generation.composer_id,
          generation_id: generation.id,
          version_name: validChoices.length > 1 ? `Música gerada #${index + 1}` : 'Versão IA',
          style: generation.request_payload?.prompt || null,
          ...versionPayload,
        })
        .select('id')
        .maybeSingle()
      savedVersionId = insertedVersion?.id || savedVersionId
    } else {
      await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', matchingVersion.id)
    }

    await backupVersionAudio(savedVersionId, generation, audioUrl, streamAudioUrl)
    savedVersions.push({ id: savedVersionId, choice })
  }

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice

  await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: isComplete ? 'completed' : 'first_ready',
        response_payload: { ...(generation.response_payload || {}), choices },
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: isComplete ? 'ready' : 'generating', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  if (isComplete) {
    const { data: project } = await supabaseAdmin
      .from('studio_projects')
      .select('id, title, style, mood, description')
      .eq('id', generation.project_id)
      .maybeSingle()

    if (project) {
      await ensureSimpleStudioCover({
        projectId: project.id,
        composerId: generation.composer_id,
        title: project.title || 'Sua música',
        style: project.style,
        mood: project.mood,
        description: project.description,
        replaceCurrent: true,
      }).catch((coverError) => {
        console.error('[Studio IA] Erro ao criar capa simples:', coverError)
      })
    }

    await notifyMusicReady(generation)
  }
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('generationId')
    if (!generationId) return NextResponse.json({ error: 'generationId obrigatório' }, { status: 400 })
    let providerStatus: string | null = null

    const { data: generation, error } = await supabaseAdmin
      .from('studio_generations')
      .select('*')
      .eq('id', generationId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!generation) return NextResponse.json({ error: 'Geração não encontrada' }, { status: 404 })

    const { data: existingVersionBeforePoll } = await supabaseAdmin
      .from('studio_versions')
      .select('id, audio_url, stream_audio_url')
      .eq('generation_id', generation.id)
      .eq('is_current', true)
      .limit(1)
      .maybeSingle()

    const needsPolling = generation.status !== 'completed' || !existingVersionBeforePoll?.audio_url
    const hasAudioBeforePoll = Boolean(existingVersionBeforePoll?.audio_url || existingVersionBeforePoll?.stream_audio_url)

    if (!hasAudioBeforePoll && isStudioGenerationTimedOut(generation)) {
      await markStudioGenerationAsCommunicationFailure(generation)
    } else if (needsPolling && generation.provider === 'sunoapi' && generation.provider_task_id && process.env.SUNOAPI_KEY) {
      const response = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${encodeURIComponent(generation.provider_task_id)}`, {
        headers: {
          Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
        },
      })
      const result = await response.json().catch(() => null)

      const status = result?.data?.status
      providerStatus = status || null
      const sunoData = getSunoTracks(result)

      if (Array.isArray(sunoData) && sunoData.length > 0 && (status === 'SUCCESS' || status === 'FIRST_SUCCESS')) {
        await saveSunoTrack(generation, sunoData, status)
      } else if (status?.includes('FAILED') || status === 'SENSITIVE_WORD_ERROR') {
        await markExpiredVoiceFromGeneration(generation, result)
        const providerError = getStudioGenerationProviderError(result) || result?.msg || status
        const friendlyError = getStudioMusicGenerationFailureMessage(providerError)
        await supabaseAdmin
          .from('studio_generations')
          .update({
            status: 'failed',
            error_message: friendlyError,
            response_payload: result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
        await releaseStudioProjectFromFailedGeneration(generation.project_id)
      } else if (result) {
        await supabaseAdmin
          .from('studio_generations')
          .update({
            response_payload: result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
      }
    } else if (needsPolling && generation.provider === 'mureka' && generation.provider_task_id && process.env.MUREKA_API_KEY) {
      const response = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(generation.provider_task_id)}`, {
        headers: {
          Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
        },
      })
      const result = await response.json().catch(() => null)

      const status = result?.status || result?.data?.status
      providerStatus = status || null
      const choices = getMurekaChoices(result)

      if (Array.isArray(choices) && choices.length > 0 && (status === 'succeeded' || status === 'streaming')) {
        await saveMurekaTrack(generation, choices, status)
      } else if (['failed', 'timeouted', 'cancelled'].includes(status)) {
        await supabaseAdmin
          .from('studio_generations')
          .update({
            status: 'failed',
            error_message: STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
            response_payload: result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
        await releaseStudioProjectFromFailedGeneration(generation.project_id)
      } else if (result) {
        await supabaseAdmin
          .from('studio_generations')
          .update({
            response_payload: result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
      }
    }

    const [{ data: freshGeneration }, { data: version }, { data: cover }] = await Promise.all([
      supabaseAdmin.from('studio_generations').select('*').eq('id', generationId).maybeSingle(),
      supabaseAdmin.from('studio_versions').select('*').eq('generation_id', generationId).eq('is_current', true).limit(1).maybeSingle(),
      supabaseAdmin.from('studio_covers').select('*').eq('project_id', generation.project_id).eq('is_current', true).maybeSingle(),
    ])
    providerStatus = providerStatus || freshGeneration?.response_payload?.data?.status || freshGeneration?.response_payload?.status || null
    const providerFinished = providerStatus === 'SUCCESS' || providerStatus === 'FIRST_SUCCESS' || providerStatus === 'succeeded' || providerStatus === 'streaming' || freshGeneration?.status === 'completed' || freshGeneration?.status === 'first_ready'
    const hasAnyAudio = Boolean(version?.audio_url || version?.stream_audio_url)
    const versionAudio = version ? await getStudioVersionAudioUrls(version) : null
    const coverImageUrl = cover ? await getStudioCoverImageUrl(cover) : null

    return NextResponse.json({
      generation: freshGeneration,
      providerStatus,
      awaitingAudioSync: Boolean(providerFinished && !hasAnyAudio),
      version: version ? {
        id: version.id,
        audioUrl: versionAudio?.audioUrl,
        streamAudioUrl: versionAudio?.streamAudioUrl,
        duration: version.duration,
      } : null,
      cover: cover ? {
        imageUrl: coverImageUrl,
        isPremium: cover.is_premium,
      } : null,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro consultar música:', error)
    return NextResponse.json({ error: error.message || 'Erro ao consultar música' }, { status: 500 })
  }
}
