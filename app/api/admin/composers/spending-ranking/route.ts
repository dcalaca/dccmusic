import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type PaymentRow = {
  paid_at?: string | null
  created_at?: string | null
  id: string
  composer_id: string
  amount: number | string | null
  status?: string | null
  payment_status?: string | null
  gateway_payment_id?: string | null
  payment_id?: string | null
  payment_preference_id?: string | null
  mercado_pago_payment_id?: string | null
}

function isPaidStatus(status?: string | null) {
  return status === 'paid' || status === 'approved' || status === 'active'
}

function paymentKey(source: string, row: PaymentRow) {
  const gatewayId = row.gateway_payment_id || row.payment_id || row.mercado_pago_payment_id || row.payment_preference_id
  return gatewayId ? `${source}:${gatewayId}` : `${source}:${row.id}`
}

function sumPaidRows(rows: PaymentRow[], source: string, start: number, end: number) {
  const seen = new Set<string>()
  const totals = new Map<string, { amount: number; count: number; historicalAmount: number; historicalCount: number; first: string | null; last: string | null }>()

  rows.forEach((row) => {
    const status = row.status || row.payment_status
    if (!isPaidStatus(status)) return

    const key = paymentKey(source, row)
    if (seen.has(key)) return
    seen.add(key)

    const amount = Number(row.amount) || 0
    if (amount <= 0) return
    const current = totals.get(row.composer_id) || { amount: 0, count: 0, historicalAmount: 0, historicalCount: 0, first: null, last: null }
    const rawDate = row.paid_at || row.created_at
    // Timestamp columns without a timezone represent UTC in this database.
    const date = rawDate ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(rawDate) ? rawDate : rawDate + 'Z') : null
    const ms = date?.getTime() ?? NaN
    const iso = Number.isFinite(ms) ? date!.toISOString() : null
    current.historicalAmount += amount
    current.historicalCount += 1
    if (iso && (!current.first || iso < current.first)) current.first = iso
    if (iso && (!current.last || iso > current.last)) current.last = iso
    if ((start === -Infinity && end === Infinity) || (ms >= start && ms < end)) {
      current.amount += amount
      current.count += 1
    }
    totals.set(row.composer_id, current)
  })

  return totals
}

async function allRows<T = any>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  // Explicit paging avoids the Data API row cap truncating customer exports.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...(data || []) as unknown as T[])
    if (!data || data.length < 500) return rows
  }
}

function dateBoundary(value: string | null, exclusiveEnd = false) {
  if (!value) return exclusiveEnd ? Infinity : -Infinity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida')
  const date = new Date(value + 'T00:00:00-03:00')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Data inválida')
  return date.getTime() + (exclusiveEnd ? 86400000 : 0)
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    let start: number, end: number
    try {
      start = dateBoundary(params.get('startDate'))
      end = dateBoundary(params.get('endDate'), true)
      if (start >= end) throw new Error('A data inicial deve ser anterior ou igual à final')
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const [composers, planPayments, topups, featuredPayments] = await Promise.all([
      allRows('dccmusic_composers', 'id, name, email, slug, created_at'),
      allRows<PaymentRow>('dccmusic_payments', 'id, composer_id, amount, status, gateway_payment_id, paid_at, created_at'),
      allRows<PaymentRow>('studio_credit_topups', 'id, composer_id, amount, status, payment_id, payment_preference_id, paid_at, created_at'),
      allRows<PaymentRow>('dccmusic_featured_payments', 'id, composer_id, amount, payment_status, mercado_pago_payment_id, created_at'),
    ])
    const planTotals = sumPaidRows(planPayments, 'plan', start, end)
    const topupTotals = sumPaidRows(topups, 'topup', start, end)
    const featuredTotals = sumPaidRows(featuredPayments, 'featured', start, end)

    const ranking = composers
      .map((composer: any) => {
        const plans = planTotals.get(composer.id) || { amount: 0, count: 0, historicalAmount: 0, historicalCount: 0, first: null, last: null }
        const topupsValue = topupTotals.get(composer.id) || { amount: 0, count: 0, historicalAmount: 0, historicalCount: 0, first: null, last: null }
        const featured = featuredTotals.get(composer.id) || { amount: 0, count: 0, historicalAmount: 0, historicalCount: 0, first: null, last: null }
        const totalSpent = plans.amount + topupsValue.amount + featured.amount
        const paymentCount = plans.count + topupsValue.count + featured.count

        return {
          composerId: composer.id,
          name: composer.name,
          email: composer.email || '',
          slug: composer.slug,
          createdAt: composer.created_at || null,
          totalSpent,
          planSpent: plans.amount,
          topupSpent: topupsValue.amount,
          featuredSpent: featured.amount,
          paymentCount,
          historicalTotalSpent: plans.historicalAmount + topupsValue.historicalAmount + featured.historicalAmount,
          historicalPaymentCount: plans.historicalCount + topupsValue.historicalCount + featured.historicalCount,
          firstPurchaseAt: [plans.first, topupsValue.first, featured.first].filter(Boolean).sort()[0] || null,
          lastPurchaseAt: [plans.last, topupsValue.last, featured.last].filter(Boolean).sort().reverse()[0] || null,
        }
      })
      .filter((row) => row.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .map((row, index) => ({
        position: index + 1,
        ...row,
      }))

    return NextResponse.json({
      ranking,
      totalComposers: composers.length,
      totalSpenders: ranking.length,
      totalRevenue: ranking.reduce((sum, row) => sum + row.totalSpent, 0),
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[SPENDING RANKING] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar ranking de gastos', details: error.message },
      { status: 500 }
    )
  }
}
