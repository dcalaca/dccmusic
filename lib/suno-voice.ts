import { getStudioCallbackUrl } from './studio'
import { translateStudioVoiceError } from './studio-voice-errors'

function getSunoApiKey() {
  const apiKey = process.env.SUNOAPI_KEY?.trim()
  if (!apiKey) throw new Error('IA de voz não configurada no servidor.')
  return apiKey
}

// A resposta do provedor também pode conter `data.id`, mas esse campo não é a
// persona de voz usada na geração musical. Só aceite os campos explícitos de voz.
export function extractSunoVoiceId(payload: any) {
  return payload?.data?.voiceId ||
    payload?.data?.voice_id ||
    payload?.voiceId ||
    payload?.voice_id ||
    null
}

function isBenignRegenerateState(payload: any) {
  if (Number(payload?.code) !== 400) return false
  const message = String(payload?.data?.errorMessage || payload?.errorMessage || payload?.msg || payload?.message || '').toLowerCase()
  return message.includes('record is not found') ||
    message.includes('does not need to be rebuilt') ||
    message.includes('does not require a retry')
}

function extractRegenerateTaskId(init: RequestInit) {
  if (typeof init.body !== 'string') return null
  try {
    const body = JSON.parse(init.body)
    return typeof body?.taskId === 'string' && body.taskId.trim() ? body.taskId.trim() : null
  } catch {
    return null
  }
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

  // Suno sometimes answers /voice/regenerate with HTTP 200 + code 400 saying
  // the record no longer needs rebuilding. This can be a transient/race state:
  // before creating a brand-new validation task, re-read the existing task once.
  if (response.ok && path === '/api/v1/voice/regenerate' && isBenignRegenerateState(payload)) {
    const taskId = extractRegenerateTaskId(init)
    if (taskId) {
      try {
        const currentState = await callSuno(`/api/v1/voice/validate-info?taskId=${encodeURIComponent(taskId)}`, {
          method: 'GET',
        })
        console.warn('[Studio Voice Provider] Regenerate retornou estado ambíguo; tarefa existente reutilizada', {
          taskId,
          providerCode: payload?.code,
        })
        return {
          ...currentState,
          data: {
            ...(currentState?.data || {}),
            taskId,
          },
        }
      } catch (refreshError) {
        // Keep the previous behavior when the task really cannot be recovered:
        // the caller may decide to create a fresh validation task.
        console.warn('[Studio Voice Provider] Não foi possível confirmar tarefa após regenerate ambíguo', {
          taskId,
        })
      }
    }
  }

  if (!response.ok || payload?.code !== 200) {
    console.error('[Studio Voice Provider] Erro na API de voz:', {
      path,
      status: response.status,
      statusText: response.statusText,
      payload,
    })
    const providerMessage = payload?.data?.errorMessage || payload?.errorMessage || payload?.msg || payload?.message
    const error = new Error(
      translateStudioVoiceError(providerMessage) ||
      'Não conseguimos iniciar o processamento da voz agora. Tente atualizar o status em alguns minutos ou envie outro áudio.'
    )
    ;(error as Error & { providerCode?: number; providerMessage?: string }).providerCode = Number(payload?.code || response.status)
    ;(error as Error & { providerCode?: number; providerMessage?: string }).providerMessage = String(providerMessage || '')
    throw error
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

export async function regenerateSunoVoiceValidation(taskId: string) {
  return callSuno('/api/v1/voice/regenerate', {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      // This endpoint uses the unusual `calBackUrl` spelling documented by Suno.
      calBackUrl: getStudioCallbackUrl('/api/studio/suno/voice-validation-callback'),
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
