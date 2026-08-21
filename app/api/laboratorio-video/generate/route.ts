import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { buildVeoLabScenePrompts, isVeoLabAspectRatio } from '@/lib/veo-lab'
import { getVeoLabApiKey } from '@/lib/veo-lab-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export async function POST(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiKey = getVeoLabApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'O Laboratório Veo ainda não tem uma chave Google configurada no servidor.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1800) : ''
  const aspectRatio = body?.aspectRatio
  if (prompt.length < 12) {
    return NextResponse.json({ error: 'Descreva a ideia visual com um pouco mais de detalhe.' }, { status: 400 })
  }
  if (!isVeoLabAspectRatio(aspectRatio)) {
    return NextResponse.json({ error: 'Formato de vídeo inválido.' }, { status: 400 })
  }

  const model = process.env.VEO_LAB_MODEL || 'veo-3.1-generate-preview'
  const scenePrompts = buildVeoLabScenePrompts(prompt)

  try {
    const operations = await Promise.all(scenePrompts.map(async (scenePrompt, index) => {
      const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt: scenePrompt }],
          parameters: {
            aspectRatio,
            resolution: '720p',
            durationSeconds: 8,
            sampleCount: 1,
          },
        }),
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.name) {
        throw new Error(result?.error?.message || `Não foi possível iniciar a cena ${index + 1}.`)
      }
      return { index, operationName: String(result.name), prompt: scenePrompt }
    }))

    return NextResponse.json({ operations, model })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o vídeo.' }, { status: 502 })
  }
}
