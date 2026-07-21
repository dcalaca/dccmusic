import { supabaseAdmin } from '@/lib/supabase'
import {
  isStudioVoiceExpiredError,
  STUDIO_AUDIO_CATALOG_MATCH_MESSAGE,
  translateStudioVoiceError,
  VOICE_EXPIRED_ERROR_MESSAGE,
} from '@/lib/studio-voice-errors'

/** Tempo máximo que a UI/API esperam áudio antes de tratar como falha de comunicação. */
export const STUDIO_MUSIC_GENERATION_TIMEOUT_MS = 10 * 60 * 1000
export const STUDIO_MUSIC_GENERATION_TIMEOUT_SECONDS = Math.floor(STUDIO_MUSIC_GENERATION_TIMEOUT_MS / 1000)

export const STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR =
  'Houve uma falha na comunicação para geração da sua música. Fica tranquilo: não foi descontado do seu saldo. Favor gerar a música novamente.'

const ACTIVE_WITHOUT_AUDIO_STATUSES = new Set(['pending', 'processing'])

export function getStudioMusicGenerationFailureMessage(providerError?: string | null) {
  if (isStudioVoiceExpiredError(providerError)) {
    return VOICE_EXPIRED_ERROR_MESSAGE
  }

  const translated = translateStudioVoiceError(providerError)
  if (translated === STUDIO_AUDIO_CATALOG_MATCH_MESSAGE) {
    return translated
  }

  return STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR
}

export function isStudioGenerationTimedOut(
  generation: { created_at?: string | null; status?: string | null },
  now = Date.now(),
) {
  if (!generation?.created_at) return false
  if (!ACTIVE_WITHOUT_AUDIO_STATUSES.has(String(generation.status || ''))) return false
  const createdAt = new Date(generation.created_at).getTime()
  if (!Number.isFinite(createdAt)) return false
  return now - createdAt >= STUDIO_MUSIC_GENERATION_TIMEOUT_MS
}

async function resolveProjectStatusAfterFailure(projectId: string, currentStatus?: string | null) {
  if (currentStatus && currentStatus !== 'generating') return currentStatus

  const { data: version } = await supabaseAdmin
    .from('studio_versions')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)
    .maybeSingle()

  return version ? 'ready' : 'draft'
}

/** Marca geração como falha e libera o projeto do status "generating". Créditos de falha não contam no saldo. */
export async function markStudioGenerationAsCommunicationFailure(
  generation: { id: string; project_id: string },
  errorMessage = STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
) {
  const now = new Date().toISOString()

  await supabaseAdmin
    .from('studio_generations')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: now,
    })
    .eq('id', generation.id)

  const { data: project } = await supabaseAdmin
    .from('studio_projects')
    .select('id, status')
    .eq('id', generation.project_id)
    .maybeSingle()

  if (project?.status === 'generating') {
    const nextStatus = await resolveProjectStatusAfterFailure(generation.project_id, project.status)
    await supabaseAdmin
      .from('studio_projects')
      .update({
        status: nextStatus,
        updated_at: now,
      })
      .eq('id', generation.project_id)
  }

  return errorMessage
}

/** Quando a geração falha por erro do provedor, também tira o projeto de "generating". */
export async function releaseStudioProjectFromFailedGeneration(projectId: string) {
  const { data: project } = await supabaseAdmin
    .from('studio_projects')
    .select('id, status')
    .eq('id', projectId)
    .maybeSingle()

  if (!project || project.status !== 'generating') return

  const nextStatus = await resolveProjectStatusAfterFailure(projectId, project.status)
  await supabaseAdmin
    .from('studio_projects')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
}
