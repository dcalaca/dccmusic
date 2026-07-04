import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  findPartnerByCode,
  getClientIp,
  getPartnerSessionId,
  hasValidPartnerCookie,
  isPartnerSchemaMissing,
  recordPartnerEvent,
  setPartnerCookies,
  upsertPartnerSession,
} from '@/lib/partners'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const partnerCode = String(body?.partnerCode || '').trim()
    const path = String(body?.path || '/').slice(0, 300)
    const sessionId = getPartnerSessionId(request)

    if (!partnerCode) {
      return NextResponse.json({ attributed: false, reason: 'missing_partner_code' })
    }

    if (hasValidPartnerCookie(request)) {
      return NextResponse.json({ attributed: false, reason: 'first_click_active' })
    }

    const partner = await findPartnerByCode(partnerCode)
    if (!partner) {
      return NextResponse.json({ attributed: false, reason: 'partner_not_found' }, { status: 404 })
    }

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
      metadata: { path, partner_code: partner.partner_code },
    })

    const response = NextResponse.json({
      attributed: true,
      partner: {
        code: partner.partner_code,
        displayName: partner.display_name,
        expiresAt: expiresAt.toISOString(),
        attributionWindowDays: windowDays,
      },
      sessionId,
    })

    setPartnerCookies(response, {
      partnerId: partner.id,
      expiresAt,
      sessionId,
    })

    return response
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ attributed: false, setupRequired: true })
    }
    console.error('[Partners Attribute] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atribuir parceiro' }, { status: 500 })
  }
}

