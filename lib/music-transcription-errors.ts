export const TRANSCRIPTION_CATALOG_MATCH_MESSAGE =
  'Não foi possível gerar a partitura e cifra porque o fornecedor identificou semelhança com uma gravação já existente no catálogo. Envie uma música original sua (não uma gravação comercial conhecida) ou escolha outra faixa do Studio IA.'

export const TRANSCRIPTION_ALREADY_PROCESSING_MESSAGE =
  'Esta música já está sendo processada para partitura e cifra. Aguarde alguns minutos e tente novamente.'

export const TRANSCRIPTION_DUPLICATE_MESSAGE =
  'Esta música já foi enviada para partitura e cifra. Se a geração anterior falhou, tente novamente em alguns minutos.'

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

export function extractProviderErrorText(payload: any): string | null {
  const candidates = [
    payload?.error?.message,
    payload?.error?.msg,
    payload?.data?.error?.message,
    payload?.data?.message,
    payload?.result?.message,
    payload?.message,
    payload?.msg,
    typeof payload?.error === 'string' ? payload.error : null,
  ]

  for (const candidate of candidates) {
    const asString = asTrimmedString(candidate)
    if (asString) return asString

    if (candidate && typeof candidate === 'object') {
      const nested =
        asTrimmedString((candidate as any).message) ||
        asTrimmedString((candidate as any).msg) ||
        asTrimmedString((candidate as any).error)
      if (nested) return nested
    }
  }

  return null
}

function normalizeErrorText(value: unknown): string {
  if (value == null) return ''

  const direct = asTrimmedString(value)
  if (direct) return direct

  if (typeof value === 'object') {
    const fromObject =
      asTrimmedString((value as any).message) ||
      asTrimmedString((value as any).error) ||
      extractProviderErrorText(value)
    if (fromObject) return fromObject
  }

  return String(value)
}

export function translateMusicTranscriptionError(value?: unknown, fallback = 'Erro ao gerar partitura e cifra.'): string {
  let message = normalizeErrorText(value)

  if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(message)
      const inner = extractProviderErrorText(parsed) || asTrimmedString(parsed?.error) || asTrimmedString(parsed?.message)
      if (inner) message = inner
    } catch {
      // Mantém o texto original se não for JSON válido.
    }
  }

  const normalized = message.toLowerCase()

  if (
    normalized.includes('matches an existing recording') ||
    normalized.includes('existing recording in our catalog') ||
    (normalized.includes('existing recording') && normalized.includes('catalog')) ||
    (normalized.includes('already exists') && (normalized.includes('catalog') || normalized.includes('recording') || normalized.includes('song'))) ||
    normalized.includes('copyrighted') ||
    normalized.includes('copyright protected')
  ) {
    return TRANSCRIPTION_CATALOG_MATCH_MESSAGE
  }

  if (normalized.includes('duplicate key') || normalized.includes('23505')) {
    return TRANSCRIPTION_DUPLICATE_MESSAGE
  }

  if (
    normalized.includes('unexpected token') ||
    normalized.includes('is not valid json') ||
    normalized.includes('unexpected end of json')
  ) {
    return 'Não foi possível processar a resposta do servidor. Tente novamente em alguns minutos.'
  }

  return message || fallback
}

export function readClientApiError(data: any, fallback: string) {
  return translateMusicTranscriptionError(data?.error ?? data?.message ?? data, fallback)
}
