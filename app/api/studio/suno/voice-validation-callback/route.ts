import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { createStudioVoiceAssetUrl } from '@/lib/studio-voice-assets'
import { createSunoCustomVoice } from '@/lib/suno-voice'
import { translateStudioVoiceError } from '@/lib/studio-voice-errors'

export const dynamic = 'force-dynamic'

function getTaskId(body: any) {
  return body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.task_id
}

function getValidateInfo(body: any) {
  return body?.data?.validateInfo ||
    body?.data?.validate_info ||
    body?.data?.validationPhrase ||
    body?.data?.phrase ||
    body?.validateInfo ||
    null
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getTaskId(body)
    const validateInfo = getValidateInfo(body)
    const errorMessage = translateStudioVoiceError(body?.data?.errorMessage || body?.errorMessage || body?.msg || null)

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const { data: voice, error: voiceError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('*')
      .eq('validation_task_id', taskId)
      .maybeSingle()

    if (voiceError) throw voiceError

    const isAutomaticReactivation = Boolean(
      voice?.provider_payload?.reactivationFree &&
      voice?.provider_payload?.autoReactivation &&
      voice?.verify_audio_path
    )

    if (voice && validateInfo && isAutomaticReactivation) {
      try {
        const verifyUrl = await createStudioVoiceAssetUrl(
          voice.verify_audio_path,
          voice.verify_audio_storage_provider
        )
        if (!verifyUrl) throw new Error('Não foi possível preparar a verificação salva da voz.')

        const voiceGeneration = await createSunoCustomVoice({
          taskId,
          verifyUrl,
          voiceName: voice.display_name,
          singerSkillLevel: voice.singer_skill_level,
        })
        const voiceGenerationTaskId = voiceGeneration?.data?.taskId || null
        if (!voiceGenerationTaskId) throw new Error('A recriação da voz não retornou uma tarefa válida.')

        const { error: automaticUpdateError } = await supabaseAdmin
          .from('studio_voice_profiles')
          .update({
            status: 'voice_processing',
            validate_info: validateInfo,
            voice_generation_task_id: voiceGenerationTaskId,
            error_message: null,
            provider_payload: {
              ...(voice.provider_payload || {}),
              validationCallback: body,
              autoReactivationGeneration: {
                voiceGeneration,
                at: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', voice.id)

        if (automaticUpdateError) throw automaticUpdateError

        console.warn('[Studio Voice] Reativação automática avançou para recriação da voz', {
          voiceProfileId: voice.id,
          validationTaskId: taskId,
          voiceGenerationTaskId,
        })

        return NextResponse.json({ received: true, processed: true, autoReactivation: true })
      } catch (automaticError: any) {
        console.error('[Studio Voice] Falha ao continuar reativação automática:', automaticError)

        const { error: fallbackUpdateError } = await supabaseAdmin
          .from('studio_voice_profiles')
          .update({
            status: 'awaiting_verification',
            validate_info: validateInfo,
            is_available: false,
            error_message: null,
            provider_payload: {
              ...(voice.provider_payload || {}),
              validationCallback: body,
              autoReactivationContinuationError: {
                message: automaticError?.message || 'Falha ao continuar reativação automática.',
                at: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', voice.id)

        if (fallbackUpdateError) throw fallbackUpdateError
        return NextResponse.json({ received: true, processed: true, autoReactivation: false })
      }
    }

    const { error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: validateInfo ? 'awaiting_verification' : 'failed',
        validate_info: validateInfo,
        error_message: validateInfo ? null : errorMessage,
        provider_payload: {
          ...(voice?.provider_payload || {}),
          validationCallback: body,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('validation_task_id', taskId)

    if (error) throw error
    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio Voice] Callback validação erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
