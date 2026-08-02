import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import {
  getComposerEmailIdentity,
  sendAdminStudioAlertEmail,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { getTrackAudioUrl, getTrackStreamAudioUrl, saveSunoGenerationTracks } from '@/lib/studio-suno-versions'
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

    // Callback "first" atrasado depois do complete não deve reprocessar (pode deixar 1 versão).
    if (generation.status === 'completed' && callbackType === 'first') {
      return NextResponse.json({ received: true, processed: false, skipped: true, reason: 'already_completed' })
    }

    const first = Array.isArray(tracks) ? tracks[0] : null
    const hasAudio = Boolean(first && (getTrackAudioUrl(first) || getTrackStreamAudioUrl(first)))
    const callbackStatus = body?.data?.status || body?.status || null
    const providerError = getStudioGenerationProviderError(body)
    const hasFailure = Boolean(callbackStatus && (String(callbackStatus).includes('FAILED') || callbackStatus === 'SENSITIVE_WORD_ERROR'))
    const status = hasAudio
      ? callbackType === 'complete'
        ? 'completed'
        : callbackType === 'first'
          ? 'first_ready'
          : 'processing'
      : hasFailure
        ? 'failed'
      : 'processing'

    if (hasFailure) {
      await markExpiredVoiceFromGeneration(generation, body)
    }

    const failureMessage = hasFailure
      ? getStudioMusicGenerationFailureMessage(providerError)
      : generation.error_message

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
      const isComplete = callbackType === 'complete'
      const savedVersions = await saveSunoGenerationTracks({ generation, tracks, isComplete })
      const currentSavedVersion = savedVersions[savedVersions.length - 1]
      const currentTrack = currentSavedVersion?.track

      if (!currentSavedVersion) {
        return NextResponse.json({ received: true, processed: false, error: 'callback sem URL de áudio' })
      }

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
        .from('studio_projects')
        .update({ status: isComplete ? 'ready' : 'generating', updated_at: new Date().toISOString() })
        .eq('id', generation.project_id)

      await supabaseAdmin
        .from('studio_inspiration_requests')
        .update({
          status: isComplete ? 'completed' : 'processing',
          response_payload: body,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_task_id', taskId)

      if (isComplete) {
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
            projectTitle: project.title || 'Sua música',
          }).catch((emailError) => {
            console.error('[Studio IA] Erro ao enviar e-mail de música pronta:', emailError)
          })
        }
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
