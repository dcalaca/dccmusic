import { NextResponse } from 'next/server'
import { isValidStudioCallback } from '@/lib/studio'

export const dynamic = 'force-dynamic'

/**
 * Mantido só por compatibilidade.
 * Separação de instrumentos passou a usar exclusivamente Mureka — sem Suno.
 */
export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await request.json().catch(() => null)
    return NextResponse.json({
      received: true,
      processed: false,
      ignored: true,
      reason: 'Stem separation agora usa apenas Mureka.',
    })
  } catch (error: any) {
    return NextResponse.json({
      received: true,
      processed: false,
      error: error?.message || 'Erro no callback',
    })
  }
}
