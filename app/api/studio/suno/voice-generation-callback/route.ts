import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { chargeStudioVoiceCreationOnce, getStudioCallbackUrl, isValidStudioCallback } from '@/lib/studio'
import { translateStudioVoiceError } from '@/lib/studio-voice-errors'

export const dynamic = 'force-dynamic'

function getTaskId(body: any) {
  return body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.task_id
}

function getVoiceId(body: any) {
  return body?.data?.voiceId ||
    body?.data?.voice_id ||
    body?.data?.id ||
    body?.voiceId ||
    body?.voice_id ||
    null
}

async function retryGenerationAfterVoiceReactivation(voice: any, voiceId: string) {
  const generationId = voice?.provider_payload?.voiceReactivation?.generationId
  if (!generationId || !process.env.SUNOAPI_KEY?.trim()) return false

  const { data: generation, error: generationError } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('id', generationId)
    .eq('composer_id', voice.composer_id)
    .maybeSingle()

  if (generationError) throw generationError
  if (!generation || generation.provider !== 'sunoapi') return false
  if (!['failed', 'processing'].includes(generation.status)) return false

  const { data: versions, error: versionsError } = await supabaseAdmin
    .from('studio_versions')
    .select('id')
    .eq('generation_id', generation.id)
    .limit(1)

  if (versionsError) throw versionsError
  if ((versions || []).length > 0) return false

  const storedPayload = generation.request_payload || {}
  const { providerAttemptLog, ...basePayload } = storedPayload
  const retryPayload = {
    ...basePayload,
    personaId: voiceId,
    personaModel: 'voice_persona',
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
  }
  const endpoint = retryPayload.uploadUrl
    ? 'https://api.sunoapi.org/api/v1/generate/upload-cover'
    : 'https://api.sunoapi.org/api/v1/generate'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(retryPayload),
  })
  const result = await response.json().catch(() => null)
  const newTaskId = result?.data?.taskId || null

  if (!response.ok || result?.code !== 200 || !newTaskId) {
    console.error('[Studio Voice] Falha ao repetir música após reativar voz:', result)
    return false
  }

  await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_task_id: newTaskId,
        status: 'processing',
        error_message: null,
        request_payload: {
          ...retryPayload,
          ...(providerAttemptLog ? { providerAttemptLog } : {}),
          voiceAutoRetry: {
            at: new Date().toISOString(),
            reactivatedVoiceProfileId: voice.id,
            reactivatedVoiceId: voiceId,
          },
        },
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  console.warn('[Studio Voice] Música repetida automaticamente após reativação da voz', {
    generationId: generation.id,
    newTaskId,
    voiceProfileId: voice.id,
  })

  return true
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getTaskId(body)
    const voiceId = getVoiceId(body)
    const status = body?.data?.status || body?.status || null
    const providerCode = Number(body?.code)
    const providerMessage = body?.data?.errorMessage || body?.errorMessage || (providerCode && providerCode !== 200 ? body?.msg : null)
    const errorMessage = translateStudioVoiceError(providerMessage)
    const explicitlyFailed = status === 'fail' || status === 'processing_validate_fail'
    const success = !explicitlyFailed && (providerCode === 200 || status === 'success')
    const failed = explicitlyFailed || (!success && Boolean(errorMessage && !voiceId))

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const nextStatus = failed ? 'failed' : success && voiceId ? 'ready' : 'voice_processing'
    const { data: voice, error: voiceError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('id, composer_id, display_name, status, provider_payload')
      .eq('voice_generation_task_id', taskId)
      .maybeSingle()

    if (voiceError) throw voiceError

    const { error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: nextStatus,
        voice_id: voiceId,
        is_available: Boolean(success && voiceId),
        error_message: failed ? errorMessage : null,
        provider_payload: {
          ...(voice?.provider_payload || {}),
          recordInfo: body,
          ...(voice?.provider_payload?.autoReactivation ? {
            autoReactivationCompletedAt: nextStatus === 'ready' ? new Date().toISOString() : null,
          } : {}),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('voice_generation_task_id', taskId)

    if (error) throw error

    if (voice && voice.status !== 'ready' && nextStatus === 'ready' && !voice.provider_payload?.reactivationFree) {
      await chargeStudioVoiceCreationOnce({
        composerId: voice.composer_id,
        voiceProfileId: voice.id,
        voiceName: voice.display_name,
        taskId,
      })
    }

    if (voice && nextStatus === 'ready' && voiceId && voice.provider_payload?.autoReactivation) {
      await retryGenerationAfterVoiceReactivation(voice, voiceId).catch((retryError) => {
        console.error('[Studio Voice] Erro no retry automático da música:', retryError)
      })
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio Voice] Callback criação erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
