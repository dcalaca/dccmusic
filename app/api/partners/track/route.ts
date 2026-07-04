import { NextRequest, NextResponse } from 'next/server'
import {
  PARTNER_COOKIE,
  PARTNER_SESSION_COOKIE,
  getClientIp,
  isPartnerSchemaMissing,
  recordPartnerEvent,
  scoreForEvent,
  TrackingEventType,
  upsertPartnerSession,
} from '@/lib/partners'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventType = String(body?.eventType || '') as TrackingEventType
    const allowedEvents: TrackingEventType[] = [
      'page_view',
      'scroll',
      'button_click',
      'signup_started',
      'signup',
      'checkout_started',
      'purchase',
      'studio_access',
      'music_generated',
      'mouse_movement',
    ]

    if (!allowedEvents.includes(eventType)) {
      return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
    }

    const partnerId = request.cookies.get(PARTNER_COOKIE)?.value || null
    const sessionId = request.cookies.get(PARTNER_SESSION_COOKIE)?.value || null
    if (!partnerId || !sessionId) {
      return NextResponse.json({ tracked: false, reason: 'no_attribution' })
    }

    await upsertPartnerSession({
      sessionId,
      partnerId,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || null,
      scoreDelta: scoreForEvent(eventType),
    })

    await recordPartnerEvent({
      sessionId,
      partnerId,
      eventType,
      metadata: body?.metadata || {},
    })

    return NextResponse.json({ tracked: true })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ tracked: false, setupRequired: true })
    }
    console.error('[Partners Track] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao rastrear evento' }, { status: 500 })
  }
}

