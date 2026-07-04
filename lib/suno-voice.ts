import { getStudioCallbackUrl } from './studio'
import { translateStudioVoiceError } from './studio-voice-errors'

function getSunoApiKey() {
  const apiKey = process.env.SUNOAPI_KEY?.trim()
  if (!apiKey) throw new Error('IA de voz não configurada no servidor.')
  return apiKey
}

async function callSuno(path: string, init: RequestInit) {
  const response = await fetch(`https://api.sunoapi.org${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSunoApiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.code !== 200) {
    console.error('[Studio Voice Provider] Erro na API de voz:', {
      path,
      status: response.status,
      statusText: response.statusText,
      payload,
    })
    throw new Error(
      translateStudioVoiceError(payload?.data?.errorMessage || payload?.errorMessage || payload?.msg || payload?.message) ||
      'Não conseguimos iniciar o processamento da voz agora. Tente atualizar o status em alguns minutos ou envie outro áudio.'
    )
  }
  return payload
}

export async function createSunoVoiceValidation(input: {
  voiceUrl: string
  vocalStartS: number
  vocalEndS: number
  language?: string
}) {
  return callSuno('/api/v1/voice/validate', {
    method: 'POST',
    body: JSON.stringify({
      voiceUrl: input.voiceUrl,
      vocalStartS: input.vocalStartS,
      vocalEndS: input.vocalEndS,
      language: input.language || 'pt',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/voice-validation-callback'),
    }),
  })
}

export async function createSunoCustomVoice(input: {
  taskId: string
  verifyUrl: string
  voiceName: string
  description?: string | null
  style?: string | null
  singerSkillLevel?: string | null
}) {
  return callSuno('/api/v1/voice/generate', {
    method: 'POST',
    body: JSON.stringify({
      taskId: input.taskId,
      verifyUrl: input.verifyUrl,
      voiceName: input.voiceName,
      description: input.description || 'Voz do compositor DCC Music',
      style: input.style || 'Brazilian music vocal',
      singerSkillLevel: input.singerSkillLevel || 'beginner',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/voice-generation-callback'),
    }),
  })
}

export async function getSunoVoiceValidationInfo(taskId: string) {
  return callSuno(`/api/v1/voice/validate-info?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
  })
}

export async function getSunoVoiceRecordInfo(taskId: string) {
  return callSuno(`/api/v1/voice/record-info?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
  })
}

export async function checkSunoVoiceAvailability(taskId: string) {
  return callSuno('/api/v1/voice/check-voice', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  })
}
