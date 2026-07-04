import { supabaseAdmin } from './supabase'
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

  await supabaseAdmin
    .from('studio_voice_profiles')
    .update({
      status: 'failed',
      is_available: false,
      error_message: VOICE_EXPIRED_ERROR_MESSAGE,
      updated_at: new Date().toISOString(),
    })
    .eq('composer_id', generation.composer_id)
    .eq('voice_id', personaId)

  return true
}
