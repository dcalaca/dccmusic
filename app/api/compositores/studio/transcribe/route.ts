import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  downloadStudioAudioBuffer,
  validateStudioInputUploadedAsset,
} from '@/lib/studio-audio-backup'
import { transcribeStudioAudioBuffer, transcribeStudioAudioFile } from '@/lib/studio-transcribe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const contentTypeHeader = request.headers.get('content-type') || ''

    // Preferido: áudio já no R2 (evita FUNCTION_PAYLOAD_TOO_LARGE)
    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json()
      validateStudioInputUploadedAsset({
        composerId: composer.composerId,
        path: String(body?.audioPath || ''),
        provider: String(body?.audioProvider || 'r2'),
        contentType: String(body?.audioContentType || 'audio/mpeg'),
        sizeBytes: Number(body?.audioSizeBytes) || 0,
      })

      const downloaded = await downloadStudioAudioBuffer(String(body.audioPath), 'r2')
      if (!downloaded) {
        return NextResponse.json({ error: 'Áudio indisponível para transcrição.' }, { status: 404 })
      }

      const text = await transcribeStudioAudioBuffer({
        buffer: downloaded.buffer,
        fileName: String(body.audioPath).split('/').pop() || 'audio.mp3',
        contentType: downloaded.contentType || String(body.audioContentType || 'audio/mpeg'),
      })
      return NextResponse.json({ text })
    }

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
      /máximo 25 MB|arquivo de áudio|antes de transcrever|encontrar texto|caminho do áudio|provedor/i.test(message)
        ? 422
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
