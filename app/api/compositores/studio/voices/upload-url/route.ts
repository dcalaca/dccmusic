import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { createStudioVoiceDirectUpload, MAX_VOICE_AUDIO_BYTES } from '@/lib/studio-voice-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const contentType = String(body?.contentType || '').trim()
    const sizeBytes = Number(body?.sizeBytes) || 0
    const kind = body?.kind === 'verify' ? 'verify' : 'source'

    const upload = await createStudioVoiceDirectUpload({
      composerId: composer.composerId,
      contentType,
      sizeBytes,
      kind,
    })

    return NextResponse.json({
      upload,
      maxBytes: MAX_VOICE_AUDIO_BYTES,
    })
  } catch (error: any) {
    console.error('[Studio Voice] Erro ao criar URL de upload:', error)
    return NextResponse.json({ error: error.message || 'Erro ao preparar upload da voz' }, { status: 500 })
  }
}
