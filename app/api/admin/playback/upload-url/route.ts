import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { createStudioInputDirectUpload } from '@/lib/studio-audio-backup'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const sizeBytes = Number(body.sizeBytes)
    if (sizeBytes > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'O áudio precisa ter no máximo 20 MB.' }, { status: 400 })
    }
    const upload = await createStudioInputDirectUpload({
      composerId: 'admin-playback',
      contentType: String(body.contentType || 'audio/mpeg'),
      sizeBytes,
      kind: 'enhance-source',
      fileName: String(body.fileName || 'musica.mp3'),
    })
    return NextResponse.json({ upload })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao preparar upload.' }, { status: 400 })
  }
}
