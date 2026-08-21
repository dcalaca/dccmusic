import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { buildVeoLabScenePrompts, isVeoLabAspectRatio, isVeoLabStoryboard, VEO_LAB_GENERATION_SECONDS } from '@/lib/veo-lab'
import { getGoogleCloudAccessToken, getVeoVertexConfig, getVeoVertexModelUrl } from '@/lib/veo-vertex'
import { createVeoCharacterReference } from '@/lib/veo-storyboard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!getComposerFromRequest(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const storyboard = body?.storyboard
  const aspectRatio = body?.aspectRatio
  if (!isVeoLabStoryboard(storyboard)) return NextResponse.json({ error: 'Crie e aprove o roteiro de cinco cenas antes de gerar.' }, { status: 400 })
  if (!isVeoLabAspectRatio(aspectRatio)) return NextResponse.json({ error: 'Formato de vídeo inválido.' }, { status: 400 })

  const scenePrompts = buildVeoLabScenePrompts(storyboard)
  try {
    const accessToken = await getGoogleCloudAccessToken()
    const { model } = getVeoVertexConfig()
    const modelUrl = getVeoVertexModelUrl()
    let characterReference: Awaited<ReturnType<typeof createVeoCharacterReference>> | null = null
    try {
      characterReference = await createVeoCharacterReference(storyboard)
    } catch (referenceError: any) {
      console.warn('[Video Lab] Character reference unavailable; using locked text identity.', referenceError?.message)
    }

    const operations = []
    for (let index = 0; index < scenePrompts.length; index += 1) {
      const scenePrompt = scenePrompts[index]
      const startGeneration = (includeReference: boolean) => fetch(`${modelUrl}:predictLongRunning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          instances: [{
            prompt: scenePrompt,
            ...(includeReference && characterReference
              ? { referenceImages: [{ image: characterReference, referenceType: 'asset' }] }
              : {}),
          }],
          parameters: { aspectRatio, resolution: '720p', durationSeconds: VEO_LAB_GENERATION_SECONDS, sampleCount: 1, seed: 741963 },
        }),
        cache: 'no-store',
      })

      let response = await startGeneration(Boolean(characterReference))
      let result = await response.json().catch(() => null)
      if (!response.ok && characterReference) {
        console.warn(`[Video Lab] Scene ${index + 1} rejected reference image; retrying text-only.`, result?.error?.message)
        response = await startGeneration(false)
        result = await response.json().catch(() => null)
      }
      if (!response.ok || !result?.name) throw new Error(result?.error?.message || `Não foi possível iniciar a cena ${index + 1}.`)
      operations.push({ index, operationName: String(result.name), prompt: scenePrompt })
    }
    return NextResponse.json({ operations, model, continuityMode: characterReference ? 'visual-reference' : 'locked-text' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o vídeo.' }, { status: 502 })
  }
}
