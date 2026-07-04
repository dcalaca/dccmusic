import { NextResponse } from 'next/server'
import { getStudioCampaignState } from '@/lib/studio-campaigns'
import { getStudioTopupTiers } from '@/lib/studio-topups'

export const dynamic = 'force-dynamic'

export async function GET() {
  const campaign = getStudioCampaignState()

  return NextResponse.json({
    campaign,
    tiers: getStudioTopupTiers().map((tier) => ({
      ...tier,
      maxMusicQuantity: Number.isFinite(tier.maxMusicQuantity) ? tier.maxMusicQuantity : null,
    })),
  })
}
