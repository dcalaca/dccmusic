import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  createStudioInputDirectUpload,
  MAX_STUDIO_INPUT_AUDIO_BYTES,
} from '@/lib/studio-audio-backup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Gera URL assinada para o navegador enviar o áudio direto ao R2. */
export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const contentType = String(body?.contentType || '').trim() || 'audio/mpeg'
    const sizeBytes = Number(body?.sizeBytes) || 0
    const kind = body?.kind === 'transcribe' ? 'transcribe' : 'enhance-source'
    const fileName = body?.fileName ? String(body.fileName) : null

    const upload = await createStudioInputDirectUpload({
      composerId: composer.composerId,
      contentType,
      sizeBytes,
      kind,
      fileName,
    })

    return NextResponse.json({
      upload,
      maxBytes: MAX_STUDIO_INPUT_AUDIO_BYTES,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar URL de upload de áudio:', error)
    return NextResponse.json({ error: error.message || 'Erro ao preparar upload' }, { status: 500 })
  }
}
