import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processProspectCampaign } from '@/lib/prospect-campaigns'
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
      maxBatchesPerCampaign: 1,
      campaignId,
    })

    const prospects = []
    if (process.env.CRON_SECRET && isAuthorized(request)) {
      const { data, error } = await supabaseAdmin.from('prospect_campaigns').select('id').eq('status', 'sending').order('created_at').limit(1)
      if (error) console.error('[PROSPECT CRON]', error)
      for (const c of data || []) {
        try { prospects.push({ id: c.id, stats: await processProspectCampaign(c.id) }) }
        catch (e) { console.error('[PROSPECT CRON]', c.id, e) }
      }
    }
    return NextResponse.json({
      prospects,
      success: true,
      processedCampaigns: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON EMAIL CAMPAIGNS] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao processar campanhas de e-mail' }, { status: 500 })
  }
}
