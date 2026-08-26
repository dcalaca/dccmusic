import { ensureMurekaVocalClone } from '@/lib/mureka-voice'
import { supabaseAdmin } from '@/lib/supabase'

const MUREKA_LYRICS_MAX_CHARS = 3000

const NON_FALLBACKABLE_PATTERNS = [
  /copyright/i,
  /copyrighted material/i,
  /direitos autorais/i,
  /sensitive[_\s-]?word/i,
  /sensitive content/i,
  /prohibited content/i,
  /policy violation/i,
  /persona.*(?:expired|invalid|disabled|unavailable)/i,
  /voice.*(?:expired|invalid|disabled|unavailable)/i,
]

function payloadText(payload: any) {
  try {
    return JSON.stringify(payload || {})
  } catch {
    return String(payload || '')
  }
}

/** Erros de conteúdo/voz não devem ser enviados a outro motor. */
export function isNonFallbackableSunoFailure(payload: any, providerError?: string | null) {
  const status = String(payload?.data?.status || payload?.status || '')
  if (status === 'SENSITIVE_WORD_ERROR') return true

  const text = `${providerError || ''} ${payloadText(payload)}`
  return NON_FALLBACKABLE_PATTERNS.some((pattern) => pattern.test(text))
}

function buildMurekaFallbackPayload(generation: any, vocalId?: string | null) {
  const original = generation?.request_payload || {}
  const lyrics = String(original.prompt || original.lyrics || '').trim()
  const style = String(original.style || original.murekaPrompt || 'Create an original, polished song.').trim()

  if (!lyrics) return null

  return {
    lyrics: lyrics.slice(0, MUREKA_LYRICS_MAX_CHARS),
    model: 'auto',
    n: 2,
    prompt: style.slice(0, 1024),
    ...(vocalId ? { vocal_id: vocalId } : {}),
    stream: true,
  }
}

async function resolveMurekaVocalId(generation: any) {
  const personaId = generation?.request_payload?.personaId
  if (!personaId) return null

  const { data: voice } = await supabaseAdmin
    .from('studio_voice_profiles')
    .select('*')
    .eq('composer_id', generation.composer_id)
    .eq('voice_id', personaId)
    .maybeSingle()

  if (!voice) throw new Error('Voz personalizada não encontrada para fallback.')
  const clone = await ensureMurekaVocalClone(voice)
  if (!clone?.vocalId) throw new Error('Voz personalizada indisponível no fallback.')
  return clone.vocalId
}

export async function startMurekaFallbackForSunoGeneration(input: {
  generation: any
  sunoFailurePayload?: any
  reason: 'callback_failure' | 'poll_failure' | 'timeout'
}) {
  const { generation, sunoFailurePayload, reason } = input
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey || generation?.provider !== 'sunoapi') {
    return { started: false as const, reason: apiKey ? 'not_suno' : 'mureka_not_configured' }
  }

  if (isNonFallbackableSunoFailure(sunoFailurePayload)) {
    return { started: false as const, reason: 'non_fallbackable_failure' }
  }

  try {
    const vocalId = await resolveMurekaVocalId(generation)
    const payload = buildMurekaFallbackPayload(generation, vocalId)
    if (!payload) return { started: false as const, reason: 'missing_lyrics' }

    const response = await fetch('https://api.mureka.ai/v1/song/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => null)
    const taskId = result?.id || result?.data?.taskId || result?.data?.id

    if (!response.ok || !taskId) {
      console.error('[Studio IA] Fallback assíncrono Mureka recusado:', result)
      return { started: false as const, reason: 'mureka_rejected', result }
    }

    const now = new Date().toISOString()
    const fallbackLog = {
      from: 'sunoapi',
      to: 'mureka',
      reason,
      previousTaskId: generation.provider_task_id,
      startedAt: now,
      sunoFailure: sunoFailurePayload || generation.response_payload || null,
    }
    const requestPayload = {
      ...payload,
      providerAttemptLog: {
        ...(generation.request_payload?.providerAttemptLog || {}),
        asyncFallback: fallbackLog,
        fallbackUsed: true,
      },
    }

    const { data: updated, error } = await supabaseAdmin
      .from('studio_generations')
      .update({
        provider: 'mureka',
        provider_task_id: String(taskId),
        status: 'processing',
        callback_type: null,
        error_message: null,
        request_payload: requestPayload,
        response_payload: { ...result, asyncFallback: fallbackLog },
        updated_at: now,
      })
      .eq('id', generation.id)
      .eq('provider', 'sunoapi')
      .select('id')
      .maybeSingle()

    if (error || !updated) {
      console.error('[Studio IA] Não foi possível vincular fallback Mureka:', error)
      return { started: false as const, reason: 'generation_changed' }
    }

    await Promise.all([
      supabaseAdmin
        .from('studio_projects')
        .update({ status: 'generating', updated_at: now })
        .eq('id', generation.project_id),
      supabaseAdmin
        .from('studio_inspiration_requests')
        .update({
          status: 'processing',
          provider_task_id: String(taskId),
          request_payload: requestPayload,
          response_payload: result,
          updated_at: now,
        })
        .eq('provider_task_id', generation.provider_task_id),
    ])

    console.info('[Studio IA] Fallback assíncrono iniciado no Mureka', {
      generationId: generation.id,
      reason,
      taskId: String(taskId),
    })
    return { started: true as const, taskId: String(taskId) }
  } catch (error: any) {
    console.error('[Studio IA] Falha ao iniciar fallback assíncrono Mureka:', error)
    return { started: false as const, reason: 'fallback_exception', error: error?.message || String(error) }
  }
}
