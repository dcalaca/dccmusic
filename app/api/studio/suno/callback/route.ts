import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import {
  getComposerEmailIdentity,
  sendAdminStudioAlertEmail,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import {
  getTrackAudioUrl,
  getTrackStreamAudioUrl,
  saveSunoGenerationTracksEnsuringTwo,
} from '@/lib/studio-suno-versions'
import { startStudioVideoGenerationWithProviderIds } from '@/lib/studio-video'
import { getStudioGenerationProviderError, markExpiredVoiceFromGeneration } from '@/lib/studio-voice-expiration'
import {
  getStudioMusicGenerationFailureMessage,
  releaseStudioProjectFromFailedGeneration,
} from '@/lib/studio-generation-timeout'

export const dynamic = 'force-dynamic'

function getCallbackTaskId(body: any) {
  return body?.data?.task_id || body?.data?.taskId || body?.task_id || body?.taskId
}

function getCallbackTracks(body: any) {
  const candidates = [
    body?.data?.data,
    body?.data?.response?.sunoData,
    body?.data?.response?.data,
    body?.data?.sunoData,
    body?.response?.sunoData,
    body?.response?.data,
    body?.sunoData,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getCallbackTaskId(body)
    const callbackType = body?.data?.callbackType || body?.callbackType
    const tracks = getCallbackTracks(body)

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const { data: generation } = await supabaseAdmin
      .from('studio_generations')
      .select('*')
      .eq('provider_task_id', taskId)
      .maybeSingle()

    if (!generation) {
      return NextResponse.json({ received: true, processed: false, error: 'geração não encontrada' })
    }

    if (generation.request_payload?.feature === 'lyric_video_refresh') {
      const videoRequestId = generation.request_payload?.videoRequestId
      const firstTrack = Array.isArray(tracks) ? tracks[0] : null
      const audioId = firstTrack?.id || firstTrack?.audio_id || firstTrack?.audioId || null
      const callbackStatus = body?.data?.status || body?.status || null
      const refreshFailed = Boolean(callbackStatus && (String(callbackStatus).includes('FAILED') || callbackStatus === 'SENSITIVE_WORD_ERROR'))
      const refreshReady = callbackType === 'complete' || body?.msg === 'All generated successfully.'

      if (refreshFailed) {
        if (videoRequestId) {
          await supabaseAdmin
            .from('studio_video_requests')
            .update({
              status: 'failed',
              error_message: 'Não consegui gerar um vídeo novo com o nome da música agora.',
              response_payload: body,
              updated_at: new Date().toISOString(),
            })
            .eq('id', videoRequestId)
        }
        await supabaseAdmin
          .from('studio_generations')
          .update({
            status: 'failed',
            callback_type: callbackType || null,
            error_message: 'Falha ao renovar o vídeo com letra.',
            response_payload: body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
        return NextResponse.json({ received: true, processed: true, feature: 'lyric_video_refresh' })
      }

      // A Suno envia callbacks intermediários (por exemplo, "text") que já
      // contêm um audioId, mas o registro ainda não está pronto para gerar MP4.
      // Só avançar quando chegar a confirmação final.
      if (!audioId || !refreshReady) {
        await supabaseAdmin
          .from('studio_generations')
          .update({
            status: 'processing',
            callback_type: callbackType || null,
            response_payload: body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id)
        return NextResponse.json({ received: true, processed: true, feature: 'lyric_video_refresh', waiting: true })
      }

      await supabaseAdmin
        .from('studio_generations')
        .update({
          status: 'completed',
          callback_type: callbackType || null,
          provider_audio_id: audioId,
          response_payload: body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)

      if (videoRequestId && generation.status !== 'completed') {
        await startStudioVideoGenerationWithProviderIds({
          videoRequestId,
          taskId,
          audioId: String(audioId),
          songTitle: generation.request_payload?.songTitle,
          artistName: generation.request_payload?.artistName,
        }).catch(async (videoError: any) => {
          console.error('[Studio IA] Erro ao gerar MP4 após renovar vídeo:', videoError)
          await supabaseAdmin
            .from('studio_video_requests')
            .update({
              status: 'failed',
              error_message: videoError?.message || 'Não consegui gerar o vídeo novo agora.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', videoRequestId)
        })
      }

      return NextResponse.json({ received: true, processed: true, feature: 'lyric_video_refresh' })
    }

    // Callback "first" atrasado depois do complete não deve reprocessar (pode deixar 1 versão).
    if (generation.status === 'completed' && callbackType === 'first') {
      return NextResponse.json({ received: true, processed: false, skipped: true, reason: 'already_completed' })
    }

    const first = Array.isArray(tracks) ? tracks[0] : null
    const hasAudio = Boolean(first && (getTrackAudioUrl(first) || getTrackStreamAudioUrl(first)))
    const callbackStatus = body?.data?.status || body?.status || null
    const providerError = getStudioGenerationProviderError(body)
    const hasFailure = Boolean(callbackStatus && (String(callbackStatus).includes('FAILED') || callbackStatus === 'SENSITIVE_WORD_ERROR'))

    if (hasFailure) {
      await markExpiredVoiceFromGeneration(generation, body)
    }

    const failureMessage = hasFailure
      ? getStudioMusicGenerationFailureMessage(providerError)
      : generation.error_message

    // Status preliminar; complete só vira completed se tivermos exatamente 2 versões.
    let status = hasAudio
      ? callbackType === 'complete'
        ? 'first_ready'
        : callbackType === 'first'
          ? 'first_ready'
          : 'processing'
      : hasFailure
        ? 'failed'
      : 'processing'

    await supabaseAdmin
      .from('studio_generations')
      .update({
        callback_type: callbackType || null,
        status,
        error_message: failureMessage,
        response_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id)

    if (hasFailure) {
      await releaseStudioProjectFromFailedGeneration(generation.project_id)
    }

    if (first && (callbackType === 'first' || callbackType === 'complete')) {
      const wantsComplete = callbackType === 'complete'
      const { savedVersions, hasExactTwo } = await saveSunoGenerationTracksEnsuringTwo({
        generation,
        tracks,
        isComplete: wantsComplete,
      })
      const currentSavedVersion = savedVersions[savedVersions.length - 1]
      const currentTrack = currentSavedVersion?.track

      if (!currentSavedVersion) {
        return NextResponse.json({ received: true, processed: false, error: 'callback sem URL de áudio' })
      }

      const fullyReady = wantsComplete && hasExactTwo
      status = fullyReady ? 'completed' : hasFailure ? 'failed' : 'first_ready'

      if (currentTrack?.image_url || currentTrack?.imageUrl || currentTrack?.source_image_url) {
        await supabaseAdmin
          .from('studio_covers')
          .update({ is_current: false })
          .eq('project_id', generation.project_id)

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

      await supabaseAdmin
        .from('studio_generations')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)

      await supabaseAdmin
        .from('studio_projects')
        .update({ status: fullyReady ? 'ready' : 'generating', updated_at: new Date().toISOString() })
        .eq('id', generation.project_id)

      await supabaseAdmin
        .from('studio_inspiration_requests')
        .update({
          status: fullyReady ? 'completed' : 'processing',
          response_payload: body,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_task_id', taskId)

      if (fullyReady) {
        const [{ data: project }, composer] = await Promise.all([
          supabaseAdmin
            .from('studio_projects')
            .select('id, title, style, mood, description')
            .eq('id', generation.project_id)
            .maybeSingle(),
          getComposerEmailIdentity(generation.composer_id),
        ])

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
      } else if (wantsComplete && !hasExactTwo) {
        console.warn('[Studio IA] Complete Suno sem 2 versões; mantendo generating', {
          generationId: generation.id,
          taskId,
          saved: savedVersions.length,
        })
      }
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio IA] Callback Suno erro:', error)
    await sendAdminStudioAlertEmail({
      title: 'Falha no callback do Studio IA',
      message: error.message || 'Erro ao processar callback de geração musical.',
      eventKey: `studio-callback-error/${Date.now()}`,
      metadata: { error: error.message },
    }).catch(() => null)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
