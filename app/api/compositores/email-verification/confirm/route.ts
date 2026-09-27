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
        { ok: false, reason: 'missing', errorCode: 'verificationTokenMissing' },
        { status: 400 }
      )
    }

    const result = await verifyComposerEmailToken(token)

    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          errorCode: result.reason === 'expired'
            ? 'verificationExpired'
            : result.reason === 'used'
              ? 'verificationUsed'
              : 'verificationInvalid',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[EMAIL VERIFY CONFIRM] Erro:', error)
    return NextResponse.json(
      { ok: false, reason: 'error', errorCode: 'verificationFailed' },
      { status: 500 }
    )
  }
}
