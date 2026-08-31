import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripeSettlement } from '@/lib/stripe'
import { STUDIO_MUSIC_CREDITS } from '@/lib/studio'

export const dynamic = 'force-dynamic'

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDateOnly(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(`${value}T00:00:00-03:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function chunk<T>(items: T[], size = 200) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

async function fetchPaged<T>(makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await makeQuery(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < 1000) break
  }
  return rows
}

function studioPlanCredits(name?: string | null, slug?: string | null) {
  const identity = `${name || ''} ${slug || ''}`.toLowerCase()
  if (identity.includes('elite')) return 300
  if (identity.includes('pro')) return 130
  if (identity.includes('studio')) return 80
  return 0
}

function topupAmountBrl(topup: any) {
  if (String(topup.currency || 'BRL').toUpperCase() === 'BRL') return Math.max(0, Number(topup.amount) || 0)
  if (String(topup.settlement_currency || '').toUpperCase() === 'BRL') return Math.max(0, Number(topup.settlement_amount) || 0)
  return 0
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const startDate = parseDateOnly(searchParams.get('startDate'), addDays(now, -29))
    const endExclusive = addDays(parseDateOnly(searchParams.get('endDate'), now), 1)

    const composers = await fetchPaged<any>((from, to) => supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email, country, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endExclusive.toISOString())
      .order('created_at', { ascending: true })
      .range(from, to)
    )
    const composerIds = composers.map(row => row.id)
    const stats = new Map(composerIds.map(id => [id, { musicCreated: 0, purchaseCount: 0, musicPurchased: 0, amountSpentBrl: 0 }]))

    for (const ids of chunk(composerIds)) {
      const [generations, payments, featured, topups, videos] = await Promise.all([
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_generations').select('id, composer_id, status').in('composer_id', ids).neq('status', 'failed').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_payments').select('id, composer_id, subscription_id, amount, status').in('composer_id', ids).eq('status', 'paid').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_featured_payments').select('id, composer_id, amount').in('composer_id', ids).eq('payment_status', 'approved').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_credit_topups').select('id, composer_id, music_quantity, amount, currency, settlement_amount, settlement_currency, payment_gateway, payment_id, metadata').in('composer_id', ids).eq('status', 'paid').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_video_requests').select('id, composer_id, amount').in('composer_id', ids).gt('amount', 0).not('paid_at', 'is', null).range(from, to)),
      ])

      const generationComposer = new Map(generations.map(row => [row.id, row.composer_id]))
      for (const generationIds of chunk(Array.from(generationComposer.keys()), 500)) {
        const versions = await fetchPaged<any>((from, to) => supabaseAdmin.from('studio_versions').select('id, generation_id').in('generation_id', generationIds).range(from, to))
        for (const version of versions) {
          const composerId = generationComposer.get(version.generation_id)
          const item = composerId ? stats.get(composerId) : null
          if (item) item.musicCreated += 1
        }
      }

      const subscriptionIds = payments.map(row => row.subscription_id).filter(Boolean)
      const subscriptions = subscriptionIds.length ? await fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_subscriptions').select('id, plan_id').in('id', subscriptionIds).range(from, to)) : []
      const planIds = subscriptions.map(row => row.plan_id).filter(Boolean)
      const plans = planIds.length ? await fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_plans').select('id, name, slug').in('id', planIds).range(from, to)) : []
      const subscriptionsById = new Map(subscriptions.map(row => [row.id, row]))
      const plansById = new Map(plans.map(row => [row.id, row]))

      for (const payment of payments) {
        const item = stats.get(payment.composer_id)
        if (!item) continue
        const subscription: any = subscriptionsById.get(payment.subscription_id)
        const plan: any = subscription ? plansById.get(subscription.plan_id) : null
        item.purchaseCount += 1
        item.musicPurchased += studioPlanCredits(plan?.name, plan?.slug) / STUDIO_MUSIC_CREDITS
        item.amountSpentBrl += Math.max(0, Number(payment.amount) || 0)
      }
      for (const payment of featured) {
        const item = stats.get(payment.composer_id)
        if (item) { item.purchaseCount += 1; item.amountSpentBrl += Math.max(0, Number(payment.amount) || 0) }
      }
      for (const payment of videos) {
        const item = stats.get(payment.composer_id)
        if (item) { item.purchaseCount += 1; item.amountSpentBrl += Math.max(0, Number(payment.amount) || 0) }
      }
      for (const topup of topups) {
        if (topup.payment_gateway === 'stripe' && String(topup.currency || 'BRL').toUpperCase() !== 'BRL' && !topup.settlement_amount && topup.payment_id) {
          const settlement = await getStripeSettlement(String(topup.payment_id)).catch(() => null)
          if (settlement?.currency === 'BRL') {
            topup.settlement_amount = settlement.amount
            topup.settlement_currency = settlement.currency
            await supabaseAdmin.from('studio_credit_topups').update({ settlement_amount: settlement.amount, settlement_currency: settlement.currency, updated_at: new Date().toISOString() }).eq('id', topup.id)
          }
        }
        const item = stats.get(topup.composer_id)
        if (!item) continue
        item.purchaseCount += 1
        item.musicPurchased += Math.max(0, Number(topup.music_quantity) || 0)
        item.amountSpentBrl += topupAmountBrl(topup)
      }
    }

    return NextResponse.json({ rows: composers.map(composer => {
      const item = stats.get(composer.id)!
      return {
        name: composer.name || 'Compositor sem nome',
        email: composer.email || '',
        country: String(composer.country || 'BR').trim().toUpperCase() || 'BR',
        musicCreated: item.musicCreated,
        purchaseCount: item.purchaseCount,
        musicPurchased: item.musicPurchased,
        amountSpentBrl: Number(item.amountSpentBrl.toFixed(2)),
      }
    }) })
  } catch (error: any) {
    console.error('[Admin Charts Export] Erro:', error)
    return NextResponse.json({ error: 'Erro ao exportar cadastros', details: error.message }, { status: 500 })
  }
}
