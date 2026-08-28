import { NextRequest, NextResponse } from 'next/server'
import { getStudioCampaignState } from '@/lib/studio-campaigns'
import { getStudioTopupTiersFromPricing } from '@/lib/studio-pricing-server'
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
  const pricing = await getStudioTopupTiersFromPricing(country)

  return NextResponse.json({
    campaign,
    country,
    currency: pricing.currency,
    pricingSource: pricing.source,
    tiers: pricing.tiers.map((tier) => ({
      maxMusicQuantity: Number.isFinite(tier.maxMusicQuantity) ? tier.maxMusicQuantity : null,
      unitPrice: tier.unitPrice,
      label: tier.label,
    })),
  })
}
