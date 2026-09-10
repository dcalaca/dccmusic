import { supabaseAdmin } from '@/lib/supabase'
import {
  isStudioVoiceExpiredError,
  STUDIO_AUDIO_CATALOG_MATCH_MESSAGE,
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

function isAudioCatalogMatchError(value?: string | null) {
  const lower = String(value || '').toLowerCase()
  return lower.includes('matches an existing recording') ||
    lower.includes('existing recording in our catalog') ||
    (lower.includes('existing recording') && lower.includes('catalog'))
}

/** Mensagem transparente para o usuário, sem revelar a infraestrutura utilizada. */
export function getTransparentStudioGenerationError(providerError?: string | null) {
  const error = normalizeProviderError(providerError)
  const lower = error.toLowerCase()

  if (!error) return STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR

  if (isAudioCatalogMatchError(error)) {
    return STUDIO_AUDIO_CATALOG_MATCH_MESSAGE
  }

  if (lower.includes('copyrighted material') || lower.includes('copyright') || lower.includes('direitos autorais')) {
    return `A letra enviada contém conteúdo identificado como protegido por direitos autorais. Altere o trecho indicado e tente novamente.${NO_CREDIT_SUFFIX}`
  }

  if (
    lower.includes("don't reference specific artists") ||
    lower.includes('do not reference specific artists') ||
    lower.includes('specific artists') ||
    lower.includes('artist name') ||
    lower.includes('specific artist')
  ) {
    return `As instruções mencionam um artista específico, e esse tipo de referência não pode ser usado na geração. Remova o nome do artista e tente novamente.${NO_CREDIT_SUFFIX}`
  }

  if (lower.includes('internal error') || lower.includes('server exception') || lower.includes('please try again later')) {
    return `O serviço de criação apresentou uma falha temporária. Tente novamente em alguns minutos.${NO_CREDIT_SUFFIX}`
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
  const rawError = String(providerError || '')
  const lower = rawError.toLowerCase()

  if (lower.includes('custom_voice_requires_suno')) {
    return 'A voz cadastrada só pode ser usada na criação original. Tente novamente quando a geração estiver disponível. Nenhum crédito foi descontado.'
  }

  if (isStudioVoiceExpiredError(providerError)) {
    return VOICE_EXPIRED_ERROR_MESSAGE
  }

  // Erros de música não devem passar pelo tradutor de validação de voz.
  // Isso evita, por exemplo, transformar um erro 500 genérico em mensagem de "áudio da voz".
  if (isAudioCatalogMatchError(rawError)) {
    return STUDIO_AUDIO_CATALOG_MATCH_MESSAGE
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
