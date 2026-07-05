import { NextRequest, NextResponse } from 'next/server'
import { verifyComposerEmailToken } from '@/lib/composer-email-verification'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = String(body?.token || '').trim()

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: 'missing', error: 'Token não informado.' },
        { status: 400 }
      )
    }

    const result = await verifyComposerEmailToken(token)

    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          error: 'O link pode estar expirado, já ter sido usado ou estar incorreto.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('[EMAIL VERIFY CONFIRM] Erro:', error)
    return NextResponse.json(
      { ok: false, reason: 'error', error: error?.message || 'Erro ao confirmar e-mail.' },
      { status: 500 }
    )
  }
}
