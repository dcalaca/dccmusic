import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { createVeoLabStoryboard } from '@/lib/veo-storyboard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!getComposerFromRequest(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const lyrics = typeof body?.lyrics === 'string' ? body.lyrics.trim() : ''
  const visualDirection = typeof body?.visualDirection === 'string' ? body.visualDirection.trim().slice(0, 1800) : ''
  if (lyrics.length < 40) return NextResponse.json({ error: 'A letra está curta demais para criar uma história.' }, { status: 400 })
  try {
    return NextResponse.json({ storyboard: await createVeoLabStoryboard(lyrics, visualDirection) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível criar o roteiro.' }, { status: 502 })
  }
}
