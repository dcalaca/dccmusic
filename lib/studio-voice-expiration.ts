import { supabaseAdmin } from './supabase'
import { createStudioVoiceAssetUrl } from './studio-voice-assets'
import { createSunoVoiceValidation } from './suno-voice'
import { isStudioVoiceExpiredError, VOICE_EXPIRED_ERROR_MESSAGE } from './studio-voice-errors'

function extractProviderErrorMessage(payload: any) {
  return payload?.data?.errorMessage ||
    payload?.data?.failed_reason ||
    payload?.errorMessage ||
    payload?.failed_reason ||
    payload?.msg ||
    payload?.message ||
    null
}

export function getStudioGenerationProviderError(payload: any) {
  return extractProviderErrorMessage(payload)
}

export async function markExpiredVoiceFromGeneration(generation: any, providerPayload: any) {
  const providerMessage = extractProviderErrorMessage(providerPayload)
  if (!isStudioVoiceExpiredError(providerMessage)) return false

  const personaId = generation?.request_payload?.personaId
  if (!personaId || !generation?.composer_id) return false

  const { data: voice, error: voiceError } = await supabaseAdmin
    .from('studio_voice_profiles')
    .select('*')
    .eq('composer_id', generation.composer_id)
    .eq('voice_id', personaId)
    .maybeSingle()

  if (voiceError) throw voiceError
  if (!voice) return false

  const now = new Date().toISOString()
  const canReactivateAutomatically = Boolean(
    voice.source_audio_path &&
    voice.verify_audio_path &&
    process.env.SUNOAPI_KEY?.trim()
  )

  if (!canReactivateAutomatically) {
    await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: 'failed',
        is_available: false,
        error_message: VOICE_EXPIRED_ERROR_MESSAGE,
        updated_at: now,
      })
      .eq('id', voice.id)

    return true
  }

  try {
    const voiceUrl = await createStudioVoiceAssetUrl(
      voice.source_audio_path,
      voice.source_audio_storage_provider
    )
    if (!voiceUrl) throw new Error('Não foi possível preparar o áudio salvo da voz.')

    const validation = await createSunoVoiceValidation({
      voiceUrl,
      vocalStartS: Number(voice.vocal_start_s) || 0,
      vocalEndS: Math.max((Number(voice.vocal_start_s) || 0) + 1, Number(voice.vocal_end_s) || 20),
      language: voice.language || 'pt',
    })
    const validationTaskId = validation?.data?.taskId || null
    if (!validationTaskId) throw new Error('A reativação da voz não retornou uma tarefa válida.')

    const { error: updateError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: 'validation_processing',
        // Preserve the last known persona while the replacement is processed.
        voice_id: voice.voice_id || null,
        is_available: false,
        validation_task_id: validationTaskId,
        validate_info: null,
        voice_generation_task_id: null,
        error_message: null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          reactivationFree: true,
          autoReactivation: true,
          voiceReactivation: {
            validation,
            at: now,
            reason: 'generation_voice_expired',
            expiredPersonaId: personaId,
            previousVoiceId: voice.voice_id || null,
            generationId: generation?.id || null,
          },
        },
        updated_at: now,
      })
      .eq('id', voice.id)

    if (updateError) throw updateError

    console.warn('[Studio Voice] Voz expirada; reativação automática iniciada', {
      voiceProfileId: voice.id,
      generationId: generation?.id || null,
      validationTaskId,
    })
  } catch (reactivationError: any) {
    console.error('[Studio Voice] Falha ao iniciar reativação automática:', reactivationError)

    await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: 'failed',
        is_available: false,
        error_message: VOICE_EXPIRED_ERROR_MESSAGE,
        provider_payload: {
          ...(voice.provider_payload || {}),
          reactivationFree: true,
          autoReactivation: true,
          autoReactivationError: {
            message: reactivationError?.message || 'Falha ao reativar voz automaticamente.',
            at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', voice.id)
  }

  return true
}
