import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { buildVeoLabScenePrompts, isVeoLabAspectRatio } from '@/lib/veo-lab'
import { getGoogleCloudAccessToken, getVeoVertexConfig, getVeoVertexModelUrl } from '@/lib/veo-vertex'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!getComposerFromRequest(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1800) : ''
  const aspectRatio = body?.aspectRatio
  if (prompt.length < 12) return NextResponse.json({ error: 'Descreva a ideia visual com um pouco mais de detalhe.' }, { status: 400 })
  if (!isVeoLabAspectRatio(aspectRatio)) return NextResponse.json({ error: 'Formato de vídeo inválido.' }, { status: 400 })

  const scenePrompts = buildVeoLabScenePrompts(prompt)
  try {
    const accessToken = await getGoogleCloudAccessToken()
    const { model } = getVeoVertexConfig()
    const modelUrl = getVeoVertexModelUrl()
    const operations = await Promise.all(scenePrompts.map(async (scenePrompt, index) => {
      const response = await fetch(`${modelUrl}:predictLongRunning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          instances: [{ prompt: scenePrompt }],
          parameters: { aspectRatio, resolution: '720p', durationSeconds: 8, sampleCount: 1 },
        }),
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.name) throw new Error(result?.error?.message || `Não foi possível iniciar a cena ${index + 1}.`)
      return { index, operationName: String(result.name), prompt: scenePrompt }
    }))
    return NextResponse.json({ operations, model })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o vídeo.' }, { status: 502 })
  }
}
