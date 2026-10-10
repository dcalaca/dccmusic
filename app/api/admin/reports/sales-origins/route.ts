import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { OriginSale, salesOrigin, summarizeOrigins } from '@/lib/sales-origins'

export const dynamic = 'force-dynamic'

const specs = [
  { table: 'dccmusic_payments', status: 'status', value: 'paid', date: 'paid_at', product: 'Assinatura', fields: 'id,composer_id,amount,currency,paid_at,gateway_payment_id,attribution_source,attribution_medium,attribution_campaign,attribution_first_source,attribution_click_ids', gateway: 'gateway_payment_id' },
  { table: 'studio_credit_topups', status: 'status', value: 'paid', date: 'paid_at', product: 'Recarga Studio', fields: 'id,composer_id,amount,currency,paid_at,payment_id,attribution_source,attribution_medium,attribution_campaign,attribution_first_source,attribution_click_ids', gateway: 'payment_id' },
  { table: 'dccmusic_featured_payments', status: 'payment_status', value: 'approved', date: 'created_at', product: 'Destaque', fields: 'id,composer_id,amount,created_at,mercado_pago_payment_id', gateway: 'mercado_pago_payment_id' },
  { table: 'studio_video_requests', status: '', value: '', date: 'paid_at', product: 'Vídeo', fields: 'id,composer_id,amount,paid_at,payment_id', gateway: 'payment_id' },
]

export async function GET(request: NextRequest) {
  if (!await getServerSession(authOptions)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const start = params.get('startDate') || today
  const end = params.get('endDate') || today
  const parse = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00-03:00`) : new Date(NaN)
  const from = parse(start), to = parse(end)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 86400000 || from.toISOString().slice(0, 10) !== start || to.toISOString().slice(0, 10) !== end) {
    return NextResponse.json({ error: 'Escolha um período válido de até 367 dias.' }, { status: 400 })
  }
  to.setUTCDate(to.getUTCDate() + 1)
  try {
    const batches = await Promise.all(specs.map(async spec => {
      const rows: any[] = []
      for (let offset = 0; ; offset += 1000) {
        let query = supabaseAdmin.from(spec.table).select(spec.fields).gte(spec.date, from.toISOString()).lt(spec.date, to.toISOString()).order(spec.date).order('id').range(offset, offset + 999)
        if (spec.status) query = query.eq(spec.status, spec.value)
        else query = query.gt('amount', 0).not('paid_at', 'is', null)
        const { data, error } = await query
        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const seen = new Set<string>()
      return rows.filter(row => {
        const key = String(row[spec.gateway] || row.id)
        if (seen.has(key)) return false
        seen.add(key)
        return Number(row.amount) > 0
      }).map(row => ({ ...row, product: spec.product, date: row[spec.date], key: `${spec.table}:${row.id}` }))
    }))
    const payments = batches.flat()
    const ids = Array.from(new Set(payments.map(row => row.composer_id).filter(Boolean)))
    const buyers = new Map<string, { name: string; email: string; marketing_attribution?: any }>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabaseAdmin.from('dccmusic_composers').select('id,name,email,marketing_attribution').in('id', ids.slice(i, i + 200))
      if (error) throw error
      for (const row of data || []) buyers.set(row.id, row)
    }
    const rows: OriginSale[] = payments.map(row => {
      const profile = buyers.get(row.composer_id)?.marketing_attribution
      const firstSource = row.attribution_first_source || profile?.first_touch?.source || ''
      const lastSource = row.attribution_source || profile?.last_touch?.source || ''
      const ids = row.attribution_click_ids && typeof row.attribution_click_ids === 'object' ? row.attribution_click_ids : {}
      const clickIdTypes = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'].filter(key => typeof ids[key] === 'string' && ids[key].trim())
      return ({
      id: row.key, buyer: buyers.get(row.composer_id)?.name || 'Sem nome', email: buyers.get(row.composer_id)?.email || '',
      paidAt: row.date, product: row.product, origin: salesOrigin(row.attribution_source, row.attribution_click_ids),
      rawSource: row.attribution_source || '', medium: row.attribution_medium || '', campaign: row.attribution_campaign || '',
      firstOrigin: firstSource ? salesOrigin(firstSource) : 'Não identificada',
      lastOrigin: lastSource ? salesOrigin(lastSource, ids) : 'Não identificada',
      attributionFirstEvidence: row.attribution_first_source ? 'Pagamento' : firstSource ? 'Perfil (pode ser posterior)' : 'Ausente',
      clickIdTypes,
      amount: Number(row.amount), currency: String(row.currency || 'BRL').toUpperCase(),
    }) }).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    return NextResponse.json({ rows, groups: summarizeOrigins(rows) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[Sales origins]', error)
    return NextResponse.json({ error: 'Não foi possível consultar as vendas. Tente novamente.' }, { status: 500 })
  }
}
