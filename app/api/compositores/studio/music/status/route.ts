import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import {
  saveSunoGenerationTracksEnsuringTwo,
} from '@/lib/studio-suno-versions'
import {
  extractMurekaChoicesFromPayload,
  saveMurekaGenerationTracksEnsuringTwo,
} from '@/lib/studio-mureka-versions'
import { getStudioGenerationProviderError, markExpiredVoiceFromGeneration } from '@/lib/studio-voice-expiration'
import {
  getStudioMusicGenerationFailureMessage,
  isStudioGenerationTimedOut,
  markStudioGenerationAsCommunicationFailure,
  releaseStudioProjectFromFailedGeneration,
} from '@/lib/studio-generation-timeout'
import { startLyriaFallbackForSunoGeneration } from '@/lib/studio-lyria-fallback'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
      generationId: generation.id,
      projectTitle: project.title || 'Sua música',
    }).catch((emailError) => {
      console.error('[Studio IA] Erro ao enviar e-mail de música pronta:', emailError)
    })
  }
}

async function saveSunoTrack(generation: any, sunoData: any[], status: string) {
  const wantsComplete = status === 'SUCCESS'
  const { savedVersions, hasExactTwo } = await saveSunoGenerationTracksEnsuringTwo({
    generation,
    tracks: sunoData,
    isComplete: wantsComplete,
  })
  if (savedVersions.length === 0) return

  const currentTrack = savedVersions[savedVersions.length - 1]?.track
  const fullyReady = wantsComplete && hasExactTwo

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
        status: fullyReady ? 'completed' : 'first_ready',
        response_payload: { ...(generation.response_payload || {}), sunoData },
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: fullyReady ? 'ready' : 'generating', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  if (fullyReady) {
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
  } else if (wantsComplete && !hasExactTwo) {
    console.warn('[Studio IA] SUCCESS Suno sem 2 versões; mantendo generating', {
      generationId: generation.id,
      saved: savedVersions.length,
    })
  }
}

async function saveMurekaTrack(generation: any, choices: any[], status: string) {
  const wantsComplete = status === 'succeeded'
  const { savedVersions, hasExactTwo } = await saveMurekaGenerationTracksEnsuringTwo({
    generation,
    choices,
    isComplete: wantsComplete,
  })
  if (savedVersions.length === 0) return

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice
  const fullyReady = wantsComplete && hasExactTwo

  await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: fullyReady ? 'completed' : 'first_ready',
        response_payload: { ...(generation.response_payload || {}), choices },
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: fullyReady ? 'ready' : 'generating', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  if (fullyReady) {
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

    if (generation.status !== 'completed') {
      await notifyMusicReady(generation)
    }
  } else if (wantsComplete && !hasExactTwo) {
    console.warn('[Studio IA] succeeded Mureka sem 2 versões; mantendo generating', {
      generationId: generation.id,
      saved: savedVersions.length,
    })
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

    const { data: existingVersionsBeforePoll } = await supabaseAdmin
      .from('studio_versions')
      .select('id, audio_url, stream_audio_url')
      .eq('generation_id', generation.id)

    const existingVersionBeforePoll = (existingVersionsBeforePoll || []).find((version: any) => (
      version.audio_url || version.stream_audio_url
    )) || null
    const versionCountBeforePoll = (existingVersionsBeforePoll || []).length
    const needsTwoProviderTracks =
      (generation.provider === 'sunoapi' || generation.provider === 'mureka') &&
      versionCountBeforePoll < 2

    const needsPolling =
      generation.status !== 'completed' ||
      !existingVersionBeforePoll?.audio_url ||
      needsTwoProviderTracks
    const hasAudioBeforePoll = Boolean(existingVersionBeforePoll?.audio_url || existingVersionBeforePoll?.stream_audio_url)

    if (!hasAudioBeforePoll && isStudioGenerationTimedOut(generation)) {
      const fallback = await startLyriaFallbackForSunoGeneration({
        generation,
        sunoFailurePayload: generation.response_payload,
        reason: 'timeout',
      })
      if (!fallback.started) {
        const fallbackError = 'error' in fallback ? fallback.error : null
        await markStudioGenerationAsCommunicationFailure(
          generation,
          fallbackError ? getStudioMusicGenerationFailureMessage(fallbackError) : undefined,
        )
      }
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
        const fallback = await startLyriaFallbackForSunoGeneration({
          generation,
          sunoFailurePayload: result,
          reason: 'poll_failure',
        })
        if (!fallback.started) {
          const fallbackError = 'error' in fallback ? fallback.error : null
          const providerError = fallbackError || getStudioGenerationProviderError(result) || result?.msg || status
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
        }
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
