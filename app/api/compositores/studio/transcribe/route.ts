import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { transcribeStudioAudioFile } from '@/lib/studio-transcribe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('audio')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Grave ou envie um áudio antes de transcrever.' }, { status: 400 })
    }
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Envie um arquivo de áudio válido.' }, { status: 400 })
    }

    const text = await transcribeStudioAudioFile(file, file.name || 'gravacao.webm')
    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao transcrever áudio:', error)
    const message = error?.message || 'Erro ao transcrever áudio'
    const status =
      /máximo 25 MB|arquivo de áudio|antes de transcrever|encontrar texto/i.test(message) ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
