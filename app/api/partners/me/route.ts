import { NextRequest, NextResponse } from 'next/server'
import { getPartnerFromRequest, isPartnerSchemaMissing } from '@/lib/partners'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const today = new Date()
  const days = Math.max(1, Math.min(365, Number(searchParams.get('days')) || 30))
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00.000`)
    const end = new Date(`${endDate}T23:59:59.999`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return {
        days,
        since: start.toISOString(),
        until: end.toISOString(),
        startDate,
        endDate,
      }
    }
  }

  const sinceDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    days,
    since: sinceDate.toISOString(),
    until: today.toISOString(),
    startDate: sinceDate.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  }
}

function formatDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10)
}

function createDateBuckets(startDate: string, endDate: string) {
  const buckets: Record<string, { date: string; signups: number; salesQuantity: number; salesValue: number }> = {}
  const cursor = new Date(`${startDate}T00:00:00.000`)
  const end = new Date(`${endDate}T00:00:00.000`)

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    buckets[key] = { date: key, signups: 0, salesQuantity: 0, salesValue: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }

  return buckets
}

function isDateWithinRange(value: string | null | undefined, since: string, until: string) {
  if (!value) return false
  const time = new Date(value).getTime()
  return time >= new Date(since).getTime() && time <= new Date(until).getTime()
}

export async function GET(request: NextRequest) {
  try {
    const partnerToken = getPartnerFromRequest(request)
    if (!partnerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { days, since, until, startDate, endDate } = getDateRange(request)

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', partnerToken.partnerId)
      .maybeSingle()

    if (partnerError) throw partnerError
    if (!partner) {
      return NextResponse.json({ isPartner: false, setupRequired: false })
    }

    const [
      { data: sessions, error: sessionsError },
      { data: events, error: eventsError },
      { data: commissions, error: commissionsError },
      { data: verifiedComposers, error: verifiedComposersError },
    ] = await Promise.all([
      supabaseAdmin
        .from('tracking_sessions')
        .select('session_id, is_human, human_score, created_at')
        .eq('partner_id', partner.id)
        .gte('created_at', since)
        .lte('created_at', until),
      supabaseAdmin
        .from('tracking_events')
        .select('event_type, metadata, user_id, created_at')
        .eq('partner_id', partner.id)
        .gte('created_at', since)
        .lte('created_at', until)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('partner_commissions')
        .select('amount, commission_amount, status, created_at')
        .eq('partner_id', partner.id)
        .gte('created_at', since)
        .lte('created_at', until),
      supabaseAdmin
        .from('dccmusic_composers')
        .select('id, email_verified, email_verified_at, partner_attributed_at, created_at')
        .eq('partner_id', partner.id)
        .eq('email_verified', true),
    ])

    if (sessionsError) throw sessionsError
    if (eventsError) throw eventsError
    if (commissionsError) throw commissionsError
    if (verifiedComposersError) throw verifiedComposersError

    const allEvents = events || []
    const allSessions = sessions || []
    const allCommissions = commissions || []
    const clicks = allEvents.filter((event: any) => event.event_type === 'page_view').length
    const validSessions = allSessions.length
    const humans = allSessions.filter((session: any) => session.is_human || Number(session.human_score) >= 60).length
    const signupDateByUserId = new Map<string, string>()

    allEvents
      .filter((event: any) => event.event_type === 'signup' && event.metadata?.confirmed === true && event.user_id)
      .forEach((event: any) => {
        signupDateByUserId.set(event.user_id, event.created_at)
      })

    for (const composer of verifiedComposers || []) {
      const confirmedAt = (composer as any).email_verified_at ||
        (composer as any).partner_attributed_at ||
        (composer as any).created_at

      if (isDateWithinRange(confirmedAt, since, until)) {
        signupDateByUserId.set((composer as any).id, confirmedAt)
      }
    }

    const signups = signupDateByUserId.size
    const purchases = allCommissions.length || allEvents.filter((event: any) => event.event_type === 'purchase').length
    const revenue = allCommissions.reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0)
    const commission = allCommissions.reduce((sum: number, row: any) => sum + (Number(row.commission_amount) || 0), 0)
    const averageTicket = purchases ? revenue / purchases : 0
    const dailyBuckets = createDateBuckets(startDate, endDate)

    Array.from(signupDateByUserId.values())
      .forEach((createdAt) => {
        const key = formatDateKey(createdAt)
        if (dailyBuckets[key]) dailyBuckets[key].signups += 1
      })

    allCommissions.forEach((commissionRow: any) => {
      const key = formatDateKey(commissionRow.created_at)
      if (!dailyBuckets[key]) return
      dailyBuckets[key].salesQuantity += 1
      dailyBuckets[key].salesValue += Number(commissionRow.amount) || 0
    })

    const daily = Object.values(dailyBuckets)

    const response = NextResponse.json({
      isPartner: true,
      setupRequired: false,
      partner: {
        displayName: partner.display_name,
        email: partner.email,
        partnerCode: partner.partner_code,
        commissionPercentage: Number(partner.commission_percentage) || 0,
        commissionModel: partner.commission_model || 'percentage',
        commissionPaymentScope: partner.commission_payment_scope || 'lifetime',
        cpaStudioTopupAmount: Number(partner.cpa_studio_topup_amount) || 0,
        cpaSubscriptionAmount: Number(partner.cpa_subscription_amount) || 0,
        commissionCapAmount: partner.commission_cap_amount == null ? null : Number(partner.commission_cap_amount) || 0,
        attributionWindowDays: Number(partner.attribution_window_days) || 15,
        customerLifetimeMonths: Number(partner.customer_lifetime_months) || 6,
        requiresPasswordChange: Boolean(partner.requires_password_change),
        isActive: partner.is_active !== false,
      },
      period: { days, since, until, startDate, endDate },
      metrics: {
        clicks,
        validSessions,
        humans,
        signups,
        purchases,
        revenue,
        commission,
        averageTicket,
        signupConversion: percent(signups, validSessions),
        purchaseConversion: percent(purchases, validSessions),
      },
      daily,
      recentEvents: allEvents.slice(0, 20),
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
    return response
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ isPartner: false, setupRequired: true })
    }
    console.error('[Partner Me] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar parceiro' }, { status: 500 })
  }
}

