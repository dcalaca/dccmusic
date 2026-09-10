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
type StudioErrorLanguage = 'pt-BR' | 'pt-PT' | 'es' | 'en'

function getStudioErrorLanguage(country?: string | null): StudioErrorLanguage {
  const code = String(country || 'BR').toUpperCase()
  if (code === 'US') return 'en'
  if (code === 'PT') return 'pt-PT'
  if (code === 'PY' || code === 'CO' || code === 'MX' || code === 'ES') return 'es'
  return 'pt-BR'
}

function withNoCreditSuffix(message: string, language: StudioErrorLanguage) {
  if (language === 'en') return `${message} No credits were deducted.`
  if (language === 'es') return `${message} No se descontaron créditos.`
  if (language === 'pt-PT') return `${message} Não foram descontados créditos.`
  return `${message}${NO_CREDIT_SUFFIX}`
}

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

function getAudioCatalogMatchMessage(language: StudioErrorLanguage) {
  if (language === 'en') {
    return 'This audio could not be used because it was identified as similar to an existing recording in the catalog. Try another audio or create a new version without reusing this audio as a reference.'
  }
  if (language === 'es') {
    return 'No fue posible usar este audio porque fue identificado como similar a una grabación existente en el catálogo. Prueba con otro audio o crea una nueva versión sin reutilizar este audio como referencia.'
  }
  if (language === 'pt-PT') {
    return 'Não foi possível utilizar este áudio porque foi identificado como semelhante a uma gravação já existente no catálogo. Tente outro áudio ou crie uma nova versão sem reutilizar este áudio como referência.'
  }
  return STUDIO_AUDIO_CATALOG_MATCH_MESSAGE
}

function getVoiceExpiredMessage(language: StudioErrorLanguage) {
  if (language === 'en') return 'The custom voice used for this song has expired. Reactivate or recreate the voice before trying again.'
  if (language === 'es') return 'La voz personalizada utilizada en esta canción ha caducado. Reactiva o vuelve a crear la voz antes de intentarlo de nuevo.'
  if (language === 'pt-PT') return 'A voz personalizada utilizada nesta música expirou. Reative ou recrie a voz antes de tentar novamente.'
  return VOICE_EXPIRED_ERROR_MESSAGE
}

/** Mensagem transparente para o usuário, sem revelar a infraestrutura utilizada. */
export function getTransparentStudioGenerationError(providerError?: string | null, country?: string | null) {
  const error = normalizeProviderError(providerError)
  const lower = error.toLowerCase()
  const language = getStudioErrorLanguage(country)

  if (!error) {
    if (language === 'en') return 'There was a communication problem while creating your song. Please try again. No credits were deducted.'
    if (language === 'es') return 'Hubo un problema de comunicación al crear tu canción. Inténtalo de nuevo. No se descontaron créditos.'
    if (language === 'pt-PT') return 'Ocorreu uma falha de comunicação ao criar a sua música. Tente novamente. Não foram descontados créditos.'
    return STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR
  }

  if (isAudioCatalogMatchError(error)) {
    return getAudioCatalogMatchMessage(language)
  }

  if (lower.includes('copyrighted material') || lower.includes('copyright') || lower.includes('direitos autorais')) {
    if (language === 'en') return withNoCreditSuffix('The submitted lyrics contain content identified as copyrighted. Change that section and try again.', language)
    if (language === 'es') return withNoCreditSuffix('La letra enviada contiene contenido identificado como protegido por derechos de autor. Modifica ese fragmento e inténtalo de nuevo.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('A letra enviada contém conteúdo identificado como protegido por direitos de autor. Altere esse trecho e tente novamente.', language)
    return withNoCreditSuffix('A letra enviada contém conteúdo identificado como protegido por direitos autorais. Altere o trecho indicado e tente novamente.', language)
  }

  if (
    lower.includes("don't reference specific artists") ||
    lower.includes('do not reference specific artists') ||
    lower.includes('specific artists') ||
    lower.includes('artist name') ||
    lower.includes('specific artist')
  ) {
    if (language === 'en') return withNoCreditSuffix("The instructions mention a specific artist, and that reference can't be used for generation. Remove the artist's name and try again.", language)
    if (language === 'es') return withNoCreditSuffix('Las instrucciones mencionan a un artista específico y ese tipo de referencia no se puede usar en la generación. Elimina el nombre del artista e inténtalo de nuevo.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('As instruções mencionam um artista específico e esse tipo de referência não pode ser utilizado na geração. Remova o nome do artista e tente novamente.', language)
    return withNoCreditSuffix('As instruções mencionam um artista específico, e esse tipo de referência não pode ser usado na geração. Remova o nome do artista e tente novamente.', language)
  }

  if (lower.includes('internal error') || lower.includes('server exception') || lower.includes('please try again later')) {
    if (language === 'en') return withNoCreditSuffix('The generation service had a temporary issue. Please try again in a few minutes.', language)
    if (language === 'es') return withNoCreditSuffix('El servicio de generación presentó un fallo temporal. Inténtalo de nuevo en unos minutos.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('O serviço de geração apresentou uma falha temporária. Tente novamente dentro de alguns minutos.', language)
    return withNoCreditSuffix('O serviço de criação apresentou uma falha temporária. Tente novamente em alguns minutos.', language)
  }

  if (lower.includes('sensitive') || lower.includes('prohibited') || lower.includes('policy violation')) {
    if (language === 'en') return withNoCreditSuffix('The lyrics contain a section that could not be processed under the content rules. Review the lyrics and try again.', language)
    if (language === 'es') return withNoCreditSuffix('La letra contiene un fragmento que no pudo procesarse según las reglas de contenido. Revisa la letra e inténtalo de nuevo.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('A letra contém um trecho que não pôde ser processado pelas regras de conteúdo. Reveja a letra e tente novamente.', language)
    return withNoCreditSuffix('A letra contém um trecho que não pôde ser processado pelas regras de conteúdo. Revise a letra e tente novamente.', language)
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    if (language === 'en') return withNoCreditSuffix('The song took longer than expected and could not be completed. Please try again.', language)
    if (language === 'es') return withNoCreditSuffix('La creación tardó más de lo esperado y no pudo completarse. Inténtalo de nuevo.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('A criação demorou mais do que o esperado e não pôde ser concluída. Tente novamente.', language)
    return withNoCreditSuffix('A criação demorou mais do que o esperado e não pôde ser concluída. Tente novamente.', language)
  }

  if (lower.includes('temporarily unavailable') || lower.includes('unavailable') || lower.includes('overloaded')) {
    if (language === 'en') return withNoCreditSuffix('The generation service is temporarily unavailable. Please try again in a few minutes.', language)
    if (language === 'es') return withNoCreditSuffix('El servicio de generación no está disponible temporalmente. Inténtalo de nuevo en unos minutos.', language)
    if (language === 'pt-PT') return withNoCreditSuffix('O serviço de geração está temporariamente indisponível. Tente novamente dentro de alguns minutos.', language)
    return withNoCreditSuffix('O serviço de criação está temporariamente indisponível. Tente novamente em alguns minutos.', language)
  }

  if (language === 'en') return withNoCreditSuffix('We could not complete the song generation. Please review your request and try again.', language)
  if (language === 'es') return withNoCreditSuffix('No pudimos completar la generación de la canción. Revisa tu solicitud e inténtalo de nuevo.', language)
  if (language === 'pt-PT') return withNoCreditSuffix('Não foi possível concluir a geração da música. Reveja o pedido e tente novamente.', language)
  return withNoCreditSuffix('Não conseguimos concluir a criação da música. Revise sua solicitação e tente novamente.', language)
}

const ACTIVE_WITHOUT_AUDIO_STATUSES = new Set(['pending', 'processing'])

export function getStudioMusicGenerationFailureMessage(providerError?: string | null, country?: string | null) {
  const rawError = String(providerError || '')
  const lower = rawError.toLowerCase()
  const language = getStudioErrorLanguage(country)

  if (lower.includes('custom_voice_requires_suno')) {
    if (language === 'en') return 'The saved voice can only be used with the original music generation. Please try again when generation is available. No credits were deducted.'
    if (language === 'es') return 'La voz guardada solo puede utilizarse en la generación original. Inténtalo de nuevo cuando la generación esté disponible. No se descontaron créditos.'
    if (language === 'pt-PT') return 'A voz guardada só pode ser utilizada na geração original. Tente novamente quando a geração estiver disponível. Não foram descontados créditos.'
    return 'A voz cadastrada só pode ser usada na criação original. Tente novamente quando a geração estiver disponível. Nenhum crédito foi descontado.'
  }

  if (isStudioVoiceExpiredError(providerError)) {
    return getVoiceExpiredMessage(language)
  }

  // Erros de música não devem passar pelo tradutor de validação de voz.
  // Isso evita, por exemplo, transformar um erro 500 genérico em mensagem de "áudio da voz".
  if (isAudioCatalogMatchError(rawError)) {
    return getAudioCatalogMatchMessage(language)
  }

  return getTransparentStudioGenerationError(providerError, country)
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
