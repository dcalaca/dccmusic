import { NextRequest, NextResponse } from 'next/server'
import { verifyVeoLabMediaUri } from '@/lib/veo-lab-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  const searchParams = new URL(request.url).searchParams
  const uri = searchParams.get('uri') || ''
  const signature = searchParams.get('signature') || ''
  if (!verifyVeoLabMediaUri(uri, signature)) return new NextResponse('Não autorizado', { status: 401 })
  let target: URL
  try {
    target = new URL(uri)
  } catch {
    return new NextResponse('URL inválida', { status: 400 })
  }
  if (target.protocol !== 'https:' || !target.hostname.endsWith('googleapis.com')) {
    return new NextResponse('Origem inválida', { status: 400 })
  }
  if (!apiKey) return new NextResponse('Chave não configurada', { status: 503 })

  const response = await fetch(target, {
    headers: {
      'x-goog-api-key': apiKey,
      ...(request.headers.get('range') ? { Range: request.headers.get('range')! } : {}),
    },
    cache: 'no-store',
  })
  const headers = new Headers()
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('Cache-Control', 'private, max-age=3600')
  return new NextResponse(response.body, { status: response.status, headers })
}
