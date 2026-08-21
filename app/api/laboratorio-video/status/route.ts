import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { createStudioAudioSignedUrl, uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'
import { downloadVertexGcsVideo, getGoogleCloudAccessToken, getVeoVertexModelUrl } from '@/lib/veo-vertex'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const operationName = new URL(request.url).searchParams.get('operation') || ''
  if (!/^projects\/[A-Za-z0-9._-]+\/locations\/[A-Za-z0-9._-]+\/publishers\/google\/models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9._-]+$/.test(operationName)) {
    return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 })
  }

  try {
    const accessToken = await getGoogleCloudAccessToken()
    const response = await fetch(`${getVeoVertexModelUrl()}:fetchPredictOperation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ operationName }),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) return NextResponse.json({ error: result?.error?.message || 'Erro ao consultar a geração.' }, { status: response.status })
    if (!result?.done) return NextResponse.json({ done: false })
    if (result?.error) return NextResponse.json({ done: true, error: result.error.message || 'A cena falhou.' })

    const video = result?.response?.videos?.[0]
      || result?.response?.generatedVideos?.[0]?.video
      || result?.response?.generateVideoResponse?.generatedSamples?.[0]?.video
    let buffer: Buffer | null = null
    if (video?.bytesBase64Encoded) buffer = Buffer.from(video.bytesBase64Encoded, 'base64')
    else if (video?.videoBytes) buffer = Buffer.from(video.videoBytes, 'base64')
    else if (video?.gcsUri) buffer = await downloadVertexGcsVideo(String(video.gcsUri), accessToken)
    if (!buffer?.byteLength) return NextResponse.json({ done: true, error: 'O Google concluiu a cena sem retornar o arquivo de vídeo.' })

    const stored = await uploadStudioAudioBuffer({
      composerId: composer.composerId,
      folder: 'exports',
      fileName: `veo-${randomUUID()}.mp4`,
      buffer,
      contentType: 'video/mp4',
    })
    const videoUrl = await createStudioAudioSignedUrl(stored.path, stored.provider)
    if (!videoUrl) return NextResponse.json({ done: true, error: 'Não foi possível preparar o vídeo para visualização.' })
    return NextResponse.json({ done: true, videoUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Falha ao consultar o Google Cloud.' }, { status: 502 })
  }
}
