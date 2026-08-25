import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Trava de segurança temporária: nenhum cron pode disparar campanhas automaticamente.
  // Os envios devem ser iniciados/continuados manualmente pelo painel até a proteção
  // de audiência e idempotência ser validada em produção.
  return NextResponse.json({
    success: true,
    paused: true,
    processedCampaigns: 0,
    results: [],
    reason: 'email_campaign_safety_lock',
    timestamp: new Date().toISOString(),
  })
}
