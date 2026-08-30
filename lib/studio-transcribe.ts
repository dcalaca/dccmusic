import { normalizeStudioLyricStructure } from '@/lib/studio-lyric-normalizer'

const MAX_TRANSCRIPTION_AUDIO_BYTES = 25 * 1024 * 1024

export type StudioTimedLyricSegment = {
  text: string
  start: number
  end: number
}

const YOUTUBE_SPAM_RE =
  /inscreva[- ]se no canal|ative o sininho|subscribe to (the|my) channel|turn on (the )?notifications|deixe seu like|compartilhe (esse|este) v[ií]deo/i

export function looksLikeTranscriptionSpam(text: string) {
  const normalized = String(text || '').trim()
  if (!normalized) return true
  if (YOUTUBE_SPAM_RE.test(normalized)) return true
  // Repetição suspeita da mesma frase curta muitas vezes
  const sentences = normalized.split(/[.!?]\s+/).map((part) => part.trim().toLowerCase()).filter(Boolean)
  if (sentences.length >= 4) {
    const counts = new Map<string, number>()
    for (const sentence of sentences) {
      counts.set(sentence, (counts.get(sentence) || 0) + 1)
    }
    const max = Math.max(...counts.values())
    if (max / sentences.length >= 0.6) return true
  }
  return false
}

export async function transcribeStudioAudioFile(file: File | Blob, fileName = 'audio.mp3') {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Transcrição de áudio não configurada no servidor.')
  }

  if (file.size <= 0) {
    throw new Error('Envie um áudio antes de transcrever.')
  }
  if (file.size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    throw new Error('O áudio para transcrição precisa ter no máximo 25 MB.')
  }

  const openAiFormData = new FormData()
  openAiFormData.set('file', file, fileName)
  openAiFormData.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1')
  openAiFormData.set('language', 'pt')
  openAiFormData.set(
    'prompt',
    'Transcreva somente a letra cantada em português brasileiro desta música. Preserve versos e repetições reais da canção. Ignore instrumentos, vinhetas, falas de YouTube, "inscreva-se no canal", "ative o sininho", pedidos de like e qualquer texto que não seja a letra cantada.'
  )

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: openAiFormData,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Não consegui entender esse áudio agora.')
  }

  const text = String(data?.text || '').trim()
  if (!text) {
    throw new Error('Não consegui encontrar texto nesse áudio. Tente cantar mais perto do microfone.')
  }
  if (looksLikeTranscriptionSpam(text)) {
    throw new Error('Não consegui capturar a letra cantada nesse áudio. Tente um áudio mais limpo, só com a voz da música.')
  }

  return formatTranscribedLyric(text)
}

/** Organiza o texto cru do Whisper em versos/estrofes cantáveis. */
export async function formatTranscribedLyric(rawText: string) {
  const raw = String(rawText || '').trim()
  if (!raw) return raw

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return normalizeStudioLyricStructure(raw).lyric
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Você formata letras de músicas brasileiras. Preserve as palavras originais. Não invente verso novo. Organize em linhas curtas cantáveis e estrofes com tags como [A], [B], [Refrão], [C] quando fizer sentido. Responda só com a letra formatada.',
          },
          {
            role: 'user',
            content: `Formate esta letra transcrita de áudio em estrofes bem legíveis:\n\n${raw.slice(0, 5000)}`,
          },
        ],
      }),
    })

    const data = await response.json().catch(() => null)
    const formatted = String(data?.choices?.[0]?.message?.content || '').trim()
    if (!response.ok || !formatted) {
      return normalizeStudioLyricStructure(raw).lyric
    }
    if (looksLikeTranscriptionSpam(formatted)) {
      return normalizeStudioLyricStructure(raw).lyric
    }

    return normalizeStudioLyricStructure(formatted).lyric
  } catch {
    return normalizeStudioLyricStructure(raw).lyric
  }
}

export async function transcribeStudioAudioBuffer(input: {
  buffer: Buffer
  fileName?: string
  contentType?: string | null
}) {
  const contentType = input.contentType || 'audio/mpeg'
  const fileName = input.fileName || 'audio.mp3'
  const blob = new Blob([new Uint8Array(input.buffer)], { type: contentType })
  return transcribeStudioAudioFile(blob, fileName)
}

/** Obtém os tempos reais da voz para sincronizar vídeos com letra. */
export async function transcribeStudioTimedLyricSegments(input: {
  buffer: Buffer
  fileName?: string
  contentType?: string | null
  lyricHint?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('Transcrição de áudio não configurada no servidor.')
  if (!input.buffer.byteLength || input.buffer.byteLength > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    throw new Error('O áudio não pode ser sincronizado agora.')
  }

  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.contentType || 'audio/mpeg' })
  const form = new FormData()
  form.set('file', blob, input.fileName || 'audio.mp3')
  form.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1')
  form.set('language', 'pt')
  form.set('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  const hint = String(input.lyricHint || '').replace(/\[[^\]]+\]/g, '').trim()
  if (hint) form.set('prompt', `Esta é a letra oficial da música. Use estas palavras ao transcrever: ${hint.slice(0, 3000)}`)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error?.message || 'Não consegui sincronizar a letra.')

  return (Array.isArray(data?.segments) ? data.segments : [])
    .map((segment: any) => ({
      text: String(segment?.text || '').trim(),
      start: Number(segment?.start),
      end: Number(segment?.end),
    }))
    .filter((segment: StudioTimedLyricSegment) => (
      segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start
    )) as StudioTimedLyricSegment[]
}
