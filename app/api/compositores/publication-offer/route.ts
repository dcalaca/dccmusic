import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/localization'
import { getStudioPlanPriceFromPricing } from '@/lib/studio-pricing-server'

export const dynamic = 'force-dynamic'

const PUBLICATION_PLAN_SLUG = 'publicacao-dcc-30d'

export async function GET(request: NextRequest) {
  try {
    const country = normalizeCountry(
      request.cookies.get(COUNTRY_COOKIE)?.value ||
      request.headers.get('x-dcc-country') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry')
    )

    const plan = await db.getPlanBySlug(PUBLICATION_PLAN_SLUG)
    if (!plan) {
      return NextResponse.json({ error: 'PUBLICATION_OFFER_UNAVAILABLE' }, { status: 404 })
    }

    const quote = await getStudioPlanPriceFromPricing(plan.slug, Number(plan.price) || 10.9, country)
    return NextResponse.json({
      slug: plan.slug,
      amount: quote.amount,
      currency: quote.currency,
      durationDays: 30,
    })
  } catch (error) {
    console.error('[PUBLICATION OFFER] Erro:', error)
    return NextResponse.json({ error: 'PUBLICATION_OFFER_UNAVAILABLE' }, { status: 500 })
  }
}
