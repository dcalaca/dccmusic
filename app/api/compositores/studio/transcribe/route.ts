import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TRANSCRIPTION_AUDIO_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Transcrição de áudio não configurada no servidor.' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('audio')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Grave ou envie um áudio antes de transcrever.' }, { status: 400 })
    }
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Envie um arquivo de áudio válido.' }, { status: 400 })
    }
    if (file.size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
      return NextResponse.json({ error: 'O áudio para transcrição precisa ter no máximo 25 MB.' }, { status: 400 })
    }

    const openAiFormData = new FormData()
    openAiFormData.set('file', file, file.name || 'gravacao.webm')
    openAiFormData.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1')
    openAiFormData.set('language', 'pt')
    openAiFormData.set(
      'prompt',
      'Transcreva uma pessoa cantando em português brasileiro. Preserve versos e repetições quando possível.'
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
      console.error('[Studio IA] Erro transcrição OpenAI:', data)
      return NextResponse.json({ error: data?.error?.message || 'Não consegui entender esse áudio agora.' }, { status: 500 })
    }

    const text = String(data?.text || '').trim()
    if (!text) {
      return NextResponse.json({ error: 'Não consegui encontrar texto nesse áudio. Tente cantar mais perto do microfone.' }, { status: 422 })
    }

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao transcrever áudio:', error)
    return NextResponse.json({ error: error.message || 'Erro ao transcrever áudio' }, { status: 500 })
  }
}
