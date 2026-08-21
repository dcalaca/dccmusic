import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { buildVeoLabScenePrompts, isVeoLabAspectRatio, isVeoLabStoryboard, VEO_LAB_GENERATION_SECONDS, VEO_LAB_SCENE_COUNT } from '@/lib/veo-lab'
import { getGoogleCloudAccessToken, getVeoVertexConfig, getVeoVertexModelUrl } from '@/lib/veo-vertex'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!getComposerFromRequest(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const storyboard = body?.storyboard
  const aspectRatio = body?.aspectRatio
  const sceneIndex = Number(body?.sceneIndex)
  if (!isVeoLabStoryboard(storyboard)) return NextResponse.json({ error: 'Crie e aprove o roteiro de cinco cenas antes de gerar.' }, { status: 400 })
  if (!isVeoLabAspectRatio(aspectRatio)) return NextResponse.json({ error: 'Formato de vídeo inválido.' }, { status: 400 })
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= VEO_LAB_SCENE_COUNT) {
    return NextResponse.json({ error: 'Cena inválida.' }, { status: 400 })
  }

  const scenePrompt = buildVeoLabScenePrompts(storyboard)[sceneIndex].slice(0, 2200)
  try {
    const accessToken = await getGoogleCloudAccessToken()
    const { model } = getVeoVertexConfig()
    const modelUrl = getVeoVertexModelUrl()
    const response = await fetch(`${modelUrl}:predictLongRunning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        instances: [{ prompt: scenePrompt }],
        parameters: {
          aspectRatio,
          resolution: '720p',
          durationSeconds: VEO_LAB_GENERATION_SECONDS,
          sampleCount: 1,
          // O preview recebe a música escolhida pelo usuário na montagem final.
          // Gerar áudio nativo no Veo seria descartado e dobraria o custo da cena.
          generateAudio: false,
        },
      }),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.name) {
      return NextResponse.json({
        error: result?.error?.message || `O Google não iniciou a cena ${sceneIndex + 1}.`,
        sceneIndex,
        providerStatus: response.status,
      }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 })
    }
    return NextResponse.json({ operation: { index: sceneIndex, operationName: String(result.name), prompt: scenePrompt }, model, continuityMode: 'locked-text' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || `Não foi possível iniciar a cena ${sceneIndex + 1}.`, sceneIndex }, { status: 502 })
  }
}
