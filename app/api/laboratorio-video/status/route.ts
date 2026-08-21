import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { extractVeoVideoUri } from '@/lib/veo-lab'
import { getVeoLabApiKey, signVeoLabMediaUri } from '@/lib/veo-lab-media'

export const dynamic = 'force-dynamic'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export async function GET(request: NextRequest) {
  if (!getComposerFromRequest(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const apiKey = getVeoLabApiKey()
  const operationName = new URL(request.url).searchParams.get('operation') || ''
  if (!apiKey) return NextResponse.json({ error: 'Chave Google não configurada.' }, { status: 503 })
  if (!/^operations\/[A-Za-z0-9._-]+$/.test(operationName)) {
    return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 })
  }

  const response = await fetch(`${API_BASE}/${operationName}`, {
    headers: { 'x-goog-api-key': apiKey },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json({ error: result?.error?.message || 'Erro ao consultar a geração.' }, { status: response.status })
  }
  if (!result?.done) return NextResponse.json({ done: false })
  if (result?.error) return NextResponse.json({ done: true, error: result.error.message || 'A cena falhou.' })

  const videoUri = extractVeoVideoUri(result)
  if (!videoUri) return NextResponse.json({ done: true, error: 'O Google concluiu a cena sem retornar o vídeo.' })
  const signature = signVeoLabMediaUri(videoUri)
  if (!signature) return NextResponse.json({ done: true, error: 'Assinatura de mídia não configurada no servidor.' })
  return NextResponse.json({
    done: true,
    videoUrl: `/api/laboratorio-video/media?uri=${encodeURIComponent(videoUri)}&signature=${signature}`,
  })
}
