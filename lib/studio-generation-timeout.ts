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

const NO_CREDIT_SUFFIX = ' Nenhum crédito foi descontado.'

function normalizeProviderError(providerError?: string | null) {
  return String(providerError || '')
    .replace(/suno(?:api)?/gi, 'sistema de criação')
    .replace(/mureka/gi, 'sistema de criação')
    .replace(/provider/gi, 'sistema de criação')
    .replace(/upstream service/gi, 'serviço de criação')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mensagem transparente para o usuário, sem revelar a infraestrutura utilizada. */
export function getTransparentStudioGenerationError(providerError?: string | null) {
  const error = normalizeProviderError(providerError)
  const lower = error.toLowerCase()

  if (!error) return STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR
  if (lower.includes('copyright') || lower.includes('copyrighted material') || lower.includes('direitos autorais')) {
    return `A letra enviada contém trechos identificados como pertencentes a uma música já existente. Altere esses trechos e tente novamente.${NO_CREDIT_SUFFIX}`
  }
  if (lower.includes('sensitive') || lower.includes('prohibited') || lower.includes('policy violation')) {
    return `A letra contém um trecho que não pôde ser processado pelas regras de conteúdo. Revise a letra e tente novamente.${NO_CREDIT_SUFFIX}`
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return `A criação demorou mais do que o esperado e não pôde ser concluída. Tente novamente.${NO_CREDIT_SUFFIX}`
  }
  if (lower.includes('temporarily unavailable') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return `O serviço de criação está temporariamente indisponível. Tente novamente em alguns minutos.${NO_CREDIT_SUFFIX}`
  }

  return `Não conseguimos concluir a criação da música. Motivo informado pelo sistema: ${error}.${NO_CREDIT_SUFFIX}`
}

const ACTIVE_WITHOUT_AUDIO_STATUSES = new Set(['pending', 'processing'])

export function getStudioMusicGenerationFailureMessage(providerError?: string | null) {
  if (String(providerError || '').toLowerCase().includes('custom_voice_requires_suno')) {
    return 'A voz cadastrada só pode ser usada na criação original. Tente novamente quando a geração estiver disponível. Nenhum crédito foi descontado.'
  }

  if (isStudioVoiceExpiredError(providerError)) {
    return VOICE_EXPIRED_ERROR_MESSAGE
  }

  const translated = translateStudioVoiceError(providerError)
  if (translated === STUDIO_AUDIO_CATALOG_MATCH_MESSAGE) {
    return translated
  }

  return getTransparentStudioGenerationError(providerError)
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
