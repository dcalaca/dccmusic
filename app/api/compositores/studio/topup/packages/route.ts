import { NextRequest, NextResponse } from 'next/server'
import { getStudioCampaignState } from '@/lib/studio-campaigns'
import { getStudioTopupCurrency, getStudioTopupTiers } from '@/lib/studio-topups'
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/localization'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const campaign = getStudioCampaignState()
  const country = normalizeCountry(
    request.cookies.get(COUNTRY_COOKIE)?.value ||
    request.headers.get('x-dcc-country') ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  )

  return NextResponse.json({
    campaign,
    country,
    currency: getStudioTopupCurrency(country),
    tiers: getStudioTopupTiers(country).map((tier) => ({
      ...tier,
      maxMusicQuantity: Number.isFinite(tier.maxMusicQuantity) ? tier.maxMusicQuantity : null,
    })),
  })
}
