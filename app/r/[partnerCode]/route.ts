import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  findPartnerByCode,
  getClientIp,
  getPartnerSessionId,
  recordPartnerEvent,
  setPartnerCookies,
  upsertPartnerSession,
} from '@/lib/partners'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { partnerCode: string } }) {
  const url = new URL(request.url)
  const target = new URL('/', url.origin)
  const partnerCode = String(params.partnerCode || '').trim()

  if (!partnerCode) {
    return NextResponse.redirect(target, 302)
  }

  target.searchParams.set('partner', partnerCode)
  target.searchParams.set('partnerTracked', '1')

  try {
    const partner = await findPartnerByCode(partnerCode)
    if (!partner) {
      target.searchParams.delete('partnerTracked')
      return NextResponse.redirect(target, 302)
    }

    const sessionId = getPartnerSessionId(request)
    const windowDays = Number(partner.attribution_window_days) || DEFAULT_ATTRIBUTION_WINDOW_DAYS
    const expiresAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000)

    await upsertPartnerSession({
      sessionId,
      partnerId: partner.id,
      linkId: partner.tracked_link_id || null,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || null,
      scoreDelta: 0,
    })

    await recordPartnerEvent({
      sessionId,
      partnerId: partner.id,
      eventType: 'page_view',
      metadata: {
        path: `/r/${partnerCode}`,
        partner_code: partner.partner_code,
        source: 'partner_redirect',
      },
    })

    const response = NextResponse.redirect(target, 302)
    setPartnerCookies(response, {
      partnerId: partner.id,
      expiresAt,
      sessionId,
    })

    return response
  } catch (error) {
    console.error('[Partner Redirect] Erro ao registrar clique:', error)
    return NextResponse.redirect(target, 302)
  }
}

