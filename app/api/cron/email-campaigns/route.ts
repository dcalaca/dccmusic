import { NextRequest, NextResponse } from 'next/server'
import { processDueEmailCampaigns } from '@/lib/admin-email-campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

    const campaignId = request.nextUrl.searchParams.get('campaignId') || undefined

    const results = await processDueEmailCampaigns({
      limitPerCampaign: 40,
      maxBatchesPerCampaign: 8,
      campaignId,
    })

    return NextResponse.json({
      success: true,
      processedCampaigns: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON EMAIL CAMPAIGNS] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar campanhas de e-mail' },
      { status: 500 }
    )
  }
}
