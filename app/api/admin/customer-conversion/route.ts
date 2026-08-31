import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripeSettlement } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next }
function parseDate(value: string | null, fallback: Date) { if (!value) return fallback; const parsed = new Date(`${value}T00:00:00-03:00`); return Number.isNaN(parsed.getTime()) ? fallback : parsed }
function chunk<T>(items: T[], size = 200) { const out: T[][] = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out }
async function fetchPaged<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) { const rows: T[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await make(from, from + 999); if (error) throw error; rows.push(...(data || [])); if ((data || []).length < 1000) break } return rows }
function rate(part: number, total: number) { return total > 0 ? (part / total) * 100 : 0 }
function topupBrl(row: any) { if (String(row.currency || 'BRL').toUpperCase() === 'BRL') return Math.max(0, Number(row.amount) || 0); if (String(row.settlement_currency || '').toUpperCase() === 'BRL') return Math.max(0, Number(row.settlement_amount) || 0); return 0 }

const EXCLUDED_AD_PATTERNS = ['tem amores que passam', 'vicio bom', 'u0eu791h']
function normalizeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
async function getMetaSpend(start: Date, endExclusive: Date, country: string | null) {
  const token = process.env.META_ACCESS_TOKEN
  const accountIds = Array.from(new Set(String(process.env.META_AD_ACCOUNT_IDS || process.env.META_AD_ACCOUNT_ID || '').split(/[,\s;]+/).map(value => value.trim()).filter(Boolean).map(value => value.startsWith('act_') ? value : `act_${value}`)))
  if (!token || accountIds.length === 0) return { spend: 0, configured: false, warning: 'Meta Ads não configurada' }
  const since = start.toISOString().slice(0, 10)
  const until = addDays(endExclusive, -1).toISOString().slice(0, 10)
  let spend = 0
  try {
    for (const accountId of accountIds) {
      const params = new URLSearchParams({ access_token: token, level: 'ad', fields: 'ad_name,campaign_name,spend', breakdowns: 'country', time_range: JSON.stringify({ since, until }), limit: '500' })
      let next: string | null = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v20.0'}/${accountId}/insights?${params}`
      while (next) {
        const response: Response = await fetch(next, { cache: 'no-store' })
        const payload: any = await response.json().catch(() => null)
        if (!response.ok || payload?.error) throw new Error(payload?.error?.message || 'Falha ao consultar Meta Ads')
        for (const row of payload?.data || []) {
          const name = normalizeName(`${row.campaign_name || ''} ${row.ad_name || ''}`)
          if (EXCLUDED_AD_PATTERNS.some(pattern => name.includes(pattern))) continue
          if (country && String(row.country || '').toUpperCase() !== country) continue
          spend += Number(row.spend) || 0
        }
        next = payload?.paging?.next || null
      }
    }
    return { spend, configured: true, warning: null }
  } catch (error: any) {
    return { spend: 0, configured: true, warning: error.message || 'Não foi possível consultar Meta Ads' }
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const start = parseDate(searchParams.get('startDate'), new Date(now.getFullYear(), now.getMonth(), 1))
    const end = parseDate(searchParams.get('endDate'), now)
    const endExclusive = addDays(end, 1)
    const requestedCountry = String(searchParams.get('country') || '').trim().toUpperCase()
    const country = /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : null
    const makeComposersQuery = (from: number, to: number) => {
      let query = supabaseAdmin.from('dccmusic_composers').select('id').gte('created_at', start.toISOString()).lt('created_at', endExclusive.toISOString()).order('created_at').range(from, to)
      if (country) query = query.ilike('country', country)
      return query
    }
    const composers = await fetchPaged<any>(makeComposersQuery)
    const ids = composers.map(row => row.id)
    const withMusic = new Set<string>()
    const buyerIds = new Set<string>()
    const revenueByComposer = new Map<string, number>()
    const purchasesByComposer = new Map<string, number>()
    let purchases = 0

    for (const composerIds of chunk(ids)) {
      const [generations, payments, featured, topups, videos] = await Promise.all([
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_generations').select('id, composer_id').in('composer_id', composerIds).neq('status', 'failed').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_payments').select('id, composer_id, amount').in('composer_id', composerIds).eq('status', 'paid').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('dccmusic_featured_payments').select('id, composer_id, amount').in('composer_id', composerIds).eq('payment_status', 'approved').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_credit_topups').select('id, composer_id, amount, currency, settlement_amount, settlement_currency, payment_gateway, payment_id').in('composer_id', composerIds).eq('status', 'paid').range(from, to)),
        fetchPaged<any>((from, to) => supabaseAdmin.from('studio_video_requests').select('id, composer_id, amount').in('composer_id', composerIds).gt('amount', 0).not('paid_at', 'is', null).range(from, to)),
      ])
      const generationComposer = new Map(generations.map(row => [row.id, row.composer_id]))
      for (const generationIds of chunk(Array.from(generationComposer.keys()), 500)) {
        const versions = await fetchPaged<any>((from, to) => supabaseAdmin.from('studio_versions').select('generation_id').in('generation_id', generationIds).range(from, to))
        for (const version of versions) { const composerId = generationComposer.get(version.generation_id); if (composerId) withMusic.add(composerId) }
      }
      const record = (composerId: string, amount: number) => { buyerIds.add(composerId); purchases += 1; purchasesByComposer.set(composerId, (purchasesByComposer.get(composerId) || 0) + 1); revenueByComposer.set(composerId, (revenueByComposer.get(composerId) || 0) + Math.max(0, amount)) }
      for (const row of payments) record(row.composer_id, Number(row.amount) || 0)
      for (const row of featured) record(row.composer_id, Number(row.amount) || 0)
      for (const row of videos) record(row.composer_id, Number(row.amount) || 0)
      for (const row of topups) {
        if (row.payment_gateway === 'stripe' && String(row.currency || 'BRL').toUpperCase() !== 'BRL' && !row.settlement_amount && row.payment_id) {
          const settlement = await getStripeSettlement(String(row.payment_id)).catch(() => null)
          if (settlement?.currency === 'BRL') { row.settlement_amount = settlement.amount; row.settlement_currency = settlement.currency; await supabaseAdmin.from('studio_credit_topups').update({ settlement_amount: settlement.amount, settlement_currency: settlement.currency, updated_at: new Date().toISOString() }).eq('id', row.id) }
        }
        record(row.composer_id, topupBrl(row))
      }
    }

    const total = ids.length
    const withMusicBuyers = Array.from(buyerIds).filter(id => withMusic.has(id))
    const withoutMusicBuyers = Array.from(buyerIds).filter(id => !withMusic.has(id))
    const withMusicRevenue = withMusicBuyers.reduce((sum, id) => sum + (revenueByComposer.get(id) || 0), 0)
    const withoutMusicRevenue = withoutMusicBuyers.reduce((sum, id) => sum + (revenueByComposer.get(id) || 0), 0)
    const revenue = withMusicRevenue + withoutMusicRevenue
    const repeatBuyers = Array.from(purchasesByComposer.values()).filter(count => count >= 2).length
    const meta = await getMetaSpend(start, endExclusive, country)
    return NextResponse.json({
      period: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }, country,
      cohort: { total, withMusic: withMusic.size, withoutMusic: total - withMusic.size, buyers: buyerIds.size, nonBuyers: total - buyerIds.size },
      conversion: { musicActivationRate: rate(withMusic.size, total), purchaseRate: rate(buyerIds.size, total), withMusicPurchaseRate: rate(withMusicBuyers.length, withMusic.size), withoutMusicPurchaseRate: rate(withoutMusicBuyers.length, total - withMusic.size), buyersWithMusicRate: rate(withMusicBuyers.length, buyerIds.size), repeatPurchaseRate: rate(repeatBuyers, buyerIds.size), repeatBuyers },
      groups: { withMusic: { total: withMusic.size, buyers: withMusicBuyers.length, nonBuyers: withMusic.size - withMusicBuyers.length, revenue: withMusicRevenue }, withoutMusic: { total: total - withMusic.size, buyers: withoutMusicBuyers.length, nonBuyers: total - withMusic.size - withoutMusicBuyers.length, revenue: withoutMusicRevenue } },
      revenue: { total: revenue, purchases, averagePerBuyer: buyerIds.size ? revenue / buyerIds.size : 0, averageTicket: purchases ? revenue / purchases : 0 },
      acquisition: { adSpend: meta.spend, configured: meta.configured, warning: meta.warning, costPerRegistration: total ? meta.spend / total : 0, costPerBuyer: buyerIds.size ? meta.spend / buyerIds.size : 0, spendPerNonBuyer: total - buyerIds.size ? meta.spend / (total - buyerIds.size) : 0, roas: meta.spend > 0 ? revenue / meta.spend : 0, revenueAfterAds: revenue - meta.spend },
    })
  } catch (error: any) { console.error('[Customer Conversion] Erro:', error); return NextResponse.json({ error: 'Erro ao calcular conversão de clientes', details: error.message }, { status: 500 }) }
}
