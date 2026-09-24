import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const key = process.env.MUREKA_API_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'MUREKA_API_KEY não configurada.' }, { status: 503 })

  try {
    const data = await request.formData()
    const audio = data.get('audio')
    if (!(audio instanceof File) || !/\.(mp3|m4a)$/i.test(audio.name)) {
      return NextResponse.json({ error: 'Selecione um arquivo MP3 ou M4A.' }, { status: 400 })
    }
    if (!audio.size || audio.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'O áudio deve ter até 10 MB.' }, { status: 400 })
    }
    const upload = new FormData()
    upload.set('purpose', 'audio')
    upload.set('file', audio)
    const uploaded = await fetch('https://api.mureka.ai/v1/files/upload', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: upload, cache: 'no-store',
    })
    const uploadResult = await uploaded.json().catch(() => null)
    const audioId = uploadResult?.id || uploadResult?.data?.id || uploadResult?.upload_audio_id
    if (!uploaded.ok || !audioId) {
      return NextResponse.json({ error: uploadResult?.message || 'O Mureka recusou o envio do áudio.' }, { status: 502 })
    }
    const response = await fetch('https://api.mureka.ai/v1/song/transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_audio_id: String(audioId) }), cache: 'no-store',
    })
    const result = await response.json().catch(() => null)
    const zipUrl = result?.zip_url || result?.data?.zip_url || result?.result?.zip_url
    if (!response.ok || typeof zipUrl !== 'string' || !zipUrl.startsWith('https://')) {
      return NextResponse.json({ error: result?.message || 'O Mureka não retornou os arquivos da transcrição.' }, { status: 502 })
    }
    return NextResponse.json({ zipUrl })
  } catch (error) {
    console.error('[Admin Mureka transcription]', error)
    return NextResponse.json({ error: 'Não foi possível concluir a transcrição. Tente novamente.' }, { status: 500 })
  }
}
