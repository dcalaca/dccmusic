import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isPartnerSchemaMissing } from '@/lib/partners'

export const dynamic = 'force-dynamic'

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDateRange(searchParams: URLSearchParams) {
  const now = new Date()
  const range = searchParams.get('range') || 'last7'
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (startDate && endDate) {
    return {
      start: startOfDay(new Date(`${startDate}T00:00:00`)),
      end: endOfDay(new Date(`${endDate}T00:00:00`)),
      range: 'custom',
    }
  }

  if (range === 'today') return { start: startOfDay(now), end: endOfDay(now), range }
  if (range === 'yesterday') {
    const yesterday = addDays(now, -1)
    return { start: startOfDay(yesterday), end: endOfDay(yesterday), range }
  }
  if (range === 'last30') return { start: startOfDay(addDays(now, -29)), end: endOfDay(now), range }
  if (range === 'currentMonth') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now), range }
  }
  if (range === 'previousMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
    return { start, end, range }
  }

  return { start: startOfDay(addDays(now, -6)), end: endOfDay(now), range: 'last7' }
}

async function fetchPaged<T>(makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const pageSize = 1000
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId') || ''
    const { start, end, range } = getDateRange(searchParams)
    const since = start.toISOString()
    const until = end.toISOString()

    let partnersQuery = supabaseAdmin
      .from('partners')
      .select('id, display_name, email, partner_code, is_active')
      .order('display_name', { ascending: true })

    if (partnerId) partnersQuery = partnersQuery.eq('id', partnerId)
    const { data: partners, error: partnersError } = await partnersQuery
    if (partnersError) throw partnersError

    const partnerMap = new Map((partners || []).map((partner: any) => [partner.id, partner]))
    const partnerIds = Array.from(partnerMap.keys())

    if (partnerIds.length === 0) {
      return NextResponse.json({
        period: { range, startDate: since, endDate: until },
        partners: [],
        totals: { clicks: 0, signups: 0, sales: 0, revenue: 0, commission: 0 },
      })
    }

    const [events, commissions] = await Promise.all([
      fetchPaged<any>((from, to) => supabaseAdmin
        .from('tracking_events')
        .select('partner_id, session_id, user_id, event_type, metadata, created_at')
        .in('partner_id', partnerIds)
        .gte('created_at', since)
        .lte('created_at', until)
        .in('event_type', ['page_view', 'signup'])
        .range(from, to)
      ),
      fetchPaged<any>((from, to) => supabaseAdmin
        .from('partner_commissions')
        .select('partner_id, purchase_id, amount, commission_amount, status, created_at')
        .in('partner_id', partnerIds)
        .gte('created_at', since)
        .lte('created_at', until)
        .in('status', ['approved', 'paid'])
        .range(from, to)
      ),
    ])

    const metrics = new Map(partnerIds.map((id) => [id, {
      clickSessions: new Set<string>(),
      signupUsers: new Set<string>(),
      sales: 0,
      revenue: 0,
      commission: 0,
    }]))

    for (const event of events) {
      const partnerMetrics = metrics.get(event.partner_id)
      if (!partnerMetrics) continue

      if (event.event_type === 'page_view' && event.session_id) {
        partnerMetrics.clickSessions.add(event.session_id)
      }

      if (event.event_type === 'signup' && event.user_id && event.metadata?.confirmed === true) {
        partnerMetrics.signupUsers.add(event.user_id)
      }
    }

    for (const commission of commissions) {
      const partnerMetrics = metrics.get(commission.partner_id)
      if (!partnerMetrics) continue
      partnerMetrics.sales += 1
      partnerMetrics.revenue += Number(commission.amount) || 0
      partnerMetrics.commission += Number(commission.commission_amount) || 0
    }

    const rows = partnerIds.map((id) => {
      const partner = partnerMap.get(id) as any
      const partnerMetrics = metrics.get(id)!
      const clicks = partnerMetrics.clickSessions.size
      const signups = partnerMetrics.signupUsers.size
      const sales = partnerMetrics.sales

      return {
        partnerId: id,
        displayName: partner.display_name,
        email: partner.email,
        partnerCode: partner.partner_code,
        isActive: partner.is_active !== false,
        clicks,
        signups,
        sales,
        revenue: Math.round(partnerMetrics.revenue * 100) / 100,
        commission: Math.round(partnerMetrics.commission * 100) / 100,
        signupRate: clicks > 0 ? Math.round((signups / clicks) * 10000) / 100 : 0,
        salesRate: signups > 0 ? Math.round((sales / signups) * 10000) / 100 : 0,
      }
    }).sort((a, b) => b.clicks - a.clicks || b.signups - a.signups || b.sales - a.sales)

    const totals = rows.reduce((sum, row) => ({
      clicks: sum.clicks + row.clicks,
      signups: sum.signups + row.signups,
      sales: sum.sales + row.sales,
      revenue: sum.revenue + row.revenue,
      commission: sum.commission + row.commission,
    }), { clicks: 0, signups: 0, sales: 0, revenue: 0, commission: 0 })

    return NextResponse.json({
      period: { range, startDate: since, endDate: until },
      partners: rows,
      totals: {
        ...totals,
        revenue: Math.round(totals.revenue * 100) / 100,
        commission: Math.round(totals.commission * 100) / 100,
      },
    })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, partners: [], totals: null })
    }
    console.error('[Admin Partners Funnel] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar funil de parceiros' }, { status: 500 })
  }
}
