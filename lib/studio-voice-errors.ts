export const VOICE_PROCESSING_ERROR_MESSAGE = 'Não conseguimos processar essa voz. Tente enviar um áudio mais limpo, com voz clara e sem instrumental.'
export const VOICE_EXPIRED_ERROR_MESSAGE = 'Essa voz cadastrada expirou e não pode mais ser usada. Envie/grave a voz novamente ou crie a música sem usar voz cadastrada.'
export const STUDIO_AUDIO_CATALOG_MATCH_MESSAGE = 'Não foi possível usar esse áudio como inspiração porque o fornecedor identificou semelhança com uma gravação já existente no catálogo. Para continuar, crie uma nova versão usando a letra e o estilo, sem reaproveitar o áudio como referência.'

export function isStudioVoiceExpiredError(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  return normalized.includes('voice has expired') ||
    normalized.includes('voice expired') ||
    normalized.includes('recreate the voice') ||
    normalized.includes('switch to a new voice')
}

export function translateStudioVoiceError(value?: string | null) {
  const message = String(value || '').trim()
  if (!message) return null

  const normalized = message.toLowerCase()

  if (normalized === 'success') return null

  if (isStudioVoiceExpiredError(message)) {
    return VOICE_EXPIRED_ERROR_MESSAGE
  }

  if (
    normalized.includes('matches an existing recording') ||
    normalized.includes('existing recording in our catalog') ||
    normalized.includes('existing recording') && normalized.includes('catalog')
  ) {
    return STUDIO_AUDIO_CATALOG_MATCH_MESSAGE
  }

  if (
    normalized.includes('voices sound different') ||
    normalized.includes('voice sound different') ||
    normalized.includes('different voice')
  ) {
    return 'A voz da gravação não parece ser a mesma da voz base. Grave a frase novamente com a mesma pessoa/voz usada no primeiro áudio.'
  }

  if (
    normalized.includes('verification phrase expired') ||
    normalized.includes('verification phrase') && normalized.includes('not found') ||
    normalized.includes('request a new phrase') ||
    normalized.includes('expired or not found')
  ) {
    return 'A frase de verificação expirou ou não foi encontrada. Gere uma nova frase e grave novamente.'
  }

  if (
    normalized.includes('internal error') ||
    normalized.includes('server exception') ||
    normalized.includes('please try again later') ||
    normalized.includes('suno')
  ) {
    return VOICE_PROCESSING_ERROR_MESSAGE
  }

  return message
}
