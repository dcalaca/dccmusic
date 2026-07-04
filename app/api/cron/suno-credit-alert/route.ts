import { NextRequest, NextResponse } from 'next/server'
import { getSunoCreditBalance, maybeSendSunoLowCreditAlert } from '@/lib/suno-credit-alert'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const balance = await getSunoCreditBalance()
    const alert = await maybeSendSunoLowCreditAlert(balance)

    return NextResponse.json({
      success: true,
      balance,
      alert,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON SUNO CREDIT ALERT] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar saldo Suno' },
      { status: 500 }
    )
  }
}
