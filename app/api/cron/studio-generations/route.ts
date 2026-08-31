import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Mantido apenas para que a configuração antiga da Vercel continue saudável.
 * Gerações novas usam callback/polling da Suno e fallback do Google Lyria.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    checked: 0,
    completed: 0,
    skipped: 'legacy_provider_disabled',
    timestamp: new Date().toISOString(),
  })
}
