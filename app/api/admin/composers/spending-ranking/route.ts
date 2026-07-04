import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type PaymentRow = {
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

function sumPaidRows(rows: PaymentRow[], source: string) {
  const seen = new Set<string>()
  const totals = new Map<string, { amount: number; count: number }>()

  rows.forEach((row) => {
    const status = row.status || row.payment_status
    if (!isPaidStatus(status)) return

    const key = paymentKey(source, row)
    if (seen.has(key)) return
    seen.add(key)

    const amount = Number(row.amount) || 0
    const current = totals.get(row.composer_id) || { amount: 0, count: 0 }
    current.amount += amount
    current.count += 1
    totals.set(row.composer_id, current)
  })

  return totals
}

async function safeRows<T = any>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    console.warn(`[SPENDING RANKING] Falha ao buscar ${label}:`, error.message || error)
    return []
  }
  return data || []
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const [composers, planPayments, topups, featuredPayments] = await Promise.all([
      safeRows('compositores', supabaseAdmin
        .from('dccmusic_composers')
        .select('id, name, email, slug, created_at')),
      safeRows<PaymentRow>('pagamentos de planos', supabaseAdmin
        .from('dccmusic_payments')
        .select('id, composer_id, amount, status, gateway_payment_id')),
      safeRows<PaymentRow>('recargas Studio IA', supabaseAdmin
        .from('studio_credit_topups')
        .select('id, composer_id, amount, status, payment_id, payment_preference_id')),
      safeRows<PaymentRow>('destaques pagos', supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('id, composer_id, amount, payment_status, mercado_pago_payment_id')),
    ])

    const planTotals = sumPaidRows(planPayments, 'plan')
    const topupTotals = sumPaidRows(topups, 'topup')
    const featuredTotals = sumPaidRows(featuredPayments, 'featured')

    const ranking = composers
      .map((composer: any) => {
        const plans = planTotals.get(composer.id) || { amount: 0, count: 0 }
        const topupsValue = topupTotals.get(composer.id) || { amount: 0, count: 0 }
        const featured = featuredTotals.get(composer.id) || { amount: 0, count: 0 }
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
