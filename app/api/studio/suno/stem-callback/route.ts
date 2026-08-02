import { NextResponse } from 'next/server'
import { isValidStudioCallback } from '@/lib/studio'
import { applySunoStemCallback } from '@/lib/studio-stems'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const result = await applySunoStemCallback(body)
    return NextResponse.json({ received: true, ...result })
  } catch (error: any) {
    console.error('[Studio Stems] suno callback error:', error)
    return NextResponse.json({
      received: true,
      processed: false,
      error: error?.message || 'Erro no callback de stems',
    })
  }
}
