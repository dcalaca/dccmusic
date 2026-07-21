import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type PurchaseRow = {
  paymentId: string
  paidAt: string | null
  amount: number
  status: string
  paymentMethod: string
  source: string
  email: string
  name: string
  firstName: string
  lastName: string
  phone: string
  document: string
  externalReference: string
  composerId: string
}

type BuyerRow = {
  email: string
  name: string
  firstName: string
  lastName: string
  phone: string
  document: string
  composerId: string
  purchaseCount: number
  totalAmount: number
  firstPurchaseAt: string | null
  lastPurchaseAt: string | null
  isRecurring: boolean
  paymentMethods: string
  sources: string
}

const TIME_ZONE = 'America/Sao_Paulo'
const MP_PAGE_LIMIT = 100
const MP_MAX_PAGES = 50

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

function formatDayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getDefaultRange() {
  const now = new Date()
  const today = formatDayKey(now)
  return {
    start: parseDateOnly(formatDayKey(addDays(new Date(`${today}T00:00:00-03:00`), -364)), now),
    end: parseDateOnly(today, now),
  }
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function digitsOnly(value: unknown) {
  return String(value || '').replace(/\D+/g, '')
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function extractPhone(payload: any): string {
  const candidates = [
    payload?.payer?.phone,
    payload?.additional_info?.payer?.phone,
    payload?.point_of_interaction?.transaction_data?.bank_info?.payer?.phone,
    payload?.metadata?.phone,
    payload?.metadata?.telefone,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const digits = digitsOnly(candidate)
      if (digits.length >= 10) return digits
      continue
    }

    const area = digitsOnly(candidate.area_code || candidate.areaCode || '')
    const number = digitsOnly(candidate.number || candidate.phone_number || candidate.phoneNumber || '')
    const combined = `${area}${number}`
    if (combined.length >= 10) return combined
    if (number.length >= 10) return number
  }

  return ''
}

function extractDocument(payload: any): string {
  const identification = payload?.payer?.identification || payload?.additional_info?.payer?.identification
  const type = String(identification?.type || '').trim().toUpperCase()
  const number = digitsOnly(identification?.number)
  if (!number) return ''
  return type ? `${type}:${number}` : number
}

function extractName(payload: any, fallback = ''): string {
  const first = String(payload?.payer?.first_name || payload?.additional_info?.payer?.first_name || '').trim()
  const last = String(payload?.payer?.last_name || payload?.additional_info?.payer?.last_name || '').trim()
  const combined = `${first} ${last}`.trim()
  if (combined) return combined

  const metadataName = String(
    payload?.metadata?.composer_name ||
    payload?.metadata?.customer_name ||
    payload?.metadata?.name ||
    ''
  ).trim()
  if (metadataName) return metadataName

  return String(fallback || '').trim()
}

function extractEmail(payload: any): string {
  return normalizeEmail(
    payload?.payer?.email ||
    payload?.additional_info?.payer?.email ||
    payload?.metadata?.email ||
    payload?.metadata?.composer_email ||
    ''
  )
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}

function isMissingTableError(error: any, tableName: string) {
  const message = String(error?.message || '').toLowerCase()
  return Boolean(error && (message.includes(tableName.toLowerCase()) || message.includes('schema cache')))
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function fetchMercadoPagoPayments(startIso: string, endIso: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    return {
      configured: false,
      payments: [] as any[],
      error: 'MERCADOPAGO_ACCESS_TOKEN não configurado',
      pages: 0,
    }
  }

  const payments: any[] = []
  let offset = 0
  let pages = 0
  let lastError: string | null = null

  for (let page = 0; page < MP_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      sort: 'date_created',
      criteria: 'desc',
      range: 'date_created',
      begin_date: startIso,
      end_date: endIso,
      limit: String(MP_PAGE_LIMIT),
      offset: String(offset),
    })

    const response = await fetch(`https://api.mercadopago.com/v1/payments/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)
    pages += 1

    if (!response.ok) {
      lastError = payload?.message || payload?.error || `Erro HTTP ${response.status} na API do Mercado Pago`
      break
    }

    const results = Array.isArray(payload?.results) ? payload.results : []
    payments.push(...results)

    const total = Number(payload?.paging?.total)
    offset += results.length

    if (results.length < MP_PAGE_LIMIT) break
    if (Number.isFinite(total) && offset >= total) break
  }

  return {
    configured: true,
    payments,
    error: lastError,
    pages,
  }
}

function mapLocalPayment(row: any, source: string, composersById: Map<string, any>): PurchaseRow | null {
  const payload = row.gateway_response || row.metadata?.mercadopago_payment || row.metadata || {}
  const composer = composersById.get(row.composer_id)
  if (!composer && !row.composer_id) return null

  const email = normalizeEmail(composer?.email) || extractEmail(payload)
  const name = String(composer?.name || '').trim() || extractName(payload)
  const { firstName, lastName } = splitName(name)
  const amount = Math.max(0, Number(row.amount) || 0)
  const gatewayId = String(row.gateway_payment_id || row.payment_id || payload?.id || '').trim()
  const paymentId = gatewayId || `${source}:${row.id}`

  return {
    paymentId,
    paidAt: row.paid_at || row.created_at || null,
    amount,
    status: 'approved',
    paymentMethod: String(row.payment_method || payload?.payment_method_id || payload?.payment_type_id || ''),
    source,
    email,
    name,
    firstName,
    lastName,
    phone: extractPhone(payload),
    document: extractDocument(payload),
    externalReference: String(payload?.external_reference || row.subscription_id || ''),
    composerId: String(row.composer_id || ''),
  }
}

function dedupeLocalPurchases(rows: PurchaseRow[]) {
  const byKey = new Map<string, PurchaseRow>()

  for (const row of rows) {
    // Prefer gateway id when present; otherwise keep unique local row id in paymentId.
    const key = row.paymentId
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, row)
      continue
    }

    // Same gateway payment appearing in more than one local table: keep one, merge details.
    byKey.set(key, {
      ...current,
      email: current.email || row.email,
      name: current.name || row.name,
      firstName: current.firstName || row.firstName,
      lastName: current.lastName || row.lastName,
      phone: current.phone || row.phone,
      document: current.document || row.document,
      paymentMethod: current.paymentMethod || row.paymentMethod,
      composerId: current.composerId || row.composerId,
      externalReference: current.externalReference || row.externalReference,
      amount: current.amount || row.amount,
      paidAt: current.paidAt || row.paidAt,
      source: current.source.includes(row.source) ? current.source : `${current.source}+${row.source}`,
    })
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0
    const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0
    return dateB - dateA
  })
}

function buildMpLookup(payments: any[]) {
  const byId = new Map<string, any>()
  for (const payment of payments) {
    if (String(payment?.status || '').toLowerCase() !== 'approved') continue
    const id = String(payment?.id || '').trim()
    if (!id) continue
    byId.set(id, payment)
  }
  return byId
}

function enrichWithMercadoPago(purchases: PurchaseRow[], mpById: Map<string, any>) {
  return purchases.map(purchase => {
    const payload = mpById.get(purchase.paymentId)
    if (!payload) return purchase

    const mpEmail = extractEmail(payload)
    const mpName = extractName(payload)
    const mpPhone = extractPhone(payload)
    const mpDocument = extractDocument(payload)
    const mpMethod = String(payload?.payment_method_id || payload?.payment_type_id || '')

    // Keep DCC composer identity as primary; only fill gaps and phone from MP.
    const name = purchase.name || mpName
    const { firstName, lastName } = splitName(name)

    return {
      ...purchase,
      email: purchase.email || mpEmail,
      name,
      firstName: purchase.firstName || firstName,
      lastName: purchase.lastName || lastName,
      phone: purchase.phone || mpPhone,
      document: purchase.document || mpDocument,
      paymentMethod: purchase.paymentMethod || mpMethod,
    }
  })
}

function buyerKey(purchase: PurchaseRow) {
  // One composer = one buyer. Never pile anonymous MP noise into the same bucket.
  if (purchase.composerId) return `composer:${purchase.composerId}`
  if (purchase.email) return `email:${purchase.email}`
  return `payment:${purchase.paymentId}`
}

function buildBuyers(purchases: PurchaseRow[]): BuyerRow[] {
  const map = new Map<string, BuyerRow & { methods: Set<string>; sourceSet: Set<string> }>()

  for (const purchase of purchases) {
    const key = buyerKey(purchase)
    const current = map.get(key)

    if (!current) {
      map.set(key, {
        email: purchase.email,
        name: purchase.name,
        firstName: purchase.firstName,
        lastName: purchase.lastName,
        phone: purchase.phone,
        document: purchase.document,
        composerId: purchase.composerId,
        purchaseCount: 1,
        totalAmount: purchase.amount,
        firstPurchaseAt: purchase.paidAt,
        lastPurchaseAt: purchase.paidAt,
        isRecurring: false,
        paymentMethods: purchase.paymentMethod,
        sources: purchase.source,
        methods: new Set(purchase.paymentMethod ? [purchase.paymentMethod] : []),
        sourceSet: new Set(purchase.source ? [purchase.source] : []),
      })
      continue
    }

    current.purchaseCount += 1
    current.totalAmount += purchase.amount
    if (!current.email && purchase.email) current.email = purchase.email
    if (!current.name && purchase.name) {
      current.name = purchase.name
      current.firstName = purchase.firstName
      current.lastName = purchase.lastName
    }
    if (!current.phone && purchase.phone) current.phone = purchase.phone
    if (!current.document && purchase.document) current.document = purchase.document
    if (!current.composerId && purchase.composerId) current.composerId = purchase.composerId
    if (purchase.paymentMethod) current.methods.add(purchase.paymentMethod)
    if (purchase.source) current.sourceSet.add(purchase.source)

    const paidAtMs = purchase.paidAt ? new Date(purchase.paidAt).getTime() : NaN
    if (Number.isFinite(paidAtMs)) {
      const firstMs = current.firstPurchaseAt ? new Date(current.firstPurchaseAt).getTime() : Infinity
      const lastMs = current.lastPurchaseAt ? new Date(current.lastPurchaseAt).getTime() : -Infinity
      if (paidAtMs < firstMs) current.firstPurchaseAt = purchase.paidAt
      if (paidAtMs > lastMs) current.lastPurchaseAt = purchase.paidAt
    }
  }

  return Array.from(map.values())
    .map(buyer => ({
      email: buyer.email,
      name: buyer.name,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      phone: buyer.phone,
      document: buyer.document,
      composerId: buyer.composerId,
      purchaseCount: buyer.purchaseCount,
      totalAmount: Number(buyer.totalAmount.toFixed(2)),
      firstPurchaseAt: buyer.firstPurchaseAt,
      lastPurchaseAt: buyer.lastPurchaseAt,
      isRecurring: buyer.purchaseCount >= 2,
      paymentMethods: Array.from(buyer.methods).join(' | '),
      sources: Array.from(buyer.sourceSet).join(' | '),
    }))
    .sort((a, b) => {
      if (b.purchaseCount !== a.purchaseCount) return b.purchaseCount - a.purchaseCount
      return b.totalAmount - a.totalAmount
    })
}

async function fetchComposersByIds(composerIds: string[]) {
  const composersById = new Map<string, any>()
  for (const ids of chunk(composerIds, 200)) {
    const result = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .in('id', ids)

    if (result.error) throw result.error
    for (const row of result.data || []) {
      composersById.set(row.id, row)
    }
  }
  return composersById
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const defaultRange = getDefaultRange()
    const startDate = parseDateOnly(searchParams.get('startDate'), defaultRange.start)
    const endDate = parseDateOnly(searchParams.get('endDate'), defaultRange.end)
    const endExclusive = addDays(endDate, 1)
    const startIso = startDate.toISOString()
    const endIso = endExclusive.toISOString()
    const format = String(searchParams.get('format') || 'json').toLowerCase()
    const scope = String(searchParams.get('scope') || 'purchases').toLowerCase()

    const [mpResult, subscriptionsResult, featuredResult, topupsResult, videosResult] = await Promise.all([
      fetchMercadoPagoPayments(startIso, endIso),
      supabaseAdmin
        .from('dccmusic_payments')
        .select('id, composer_id, subscription_id, amount, payment_method, gateway_payment_id, gateway_response, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('id, composer_id, amount, created_at')
        .eq('payment_status', 'approved')
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_credit_topups')
        .select('id, composer_id, amount, payment_id, metadata, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('studio_video_requests')
        .select('id, composer_id, amount, payment_id, metadata, paid_at, created_at')
        .gt('amount', 0)
        .not('paid_at', 'is', null)
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
    ])

    const topupsMissing = isMissingTableError(topupsResult.error, 'studio_credit_topups')
    const localErrors = [
      subscriptionsResult.error,
      featuredResult.error,
      topupsMissing ? null : topupsResult.error,
      videosResult.error,
    ].filter(Boolean)

    if (localErrors.length > 0) {
      console.error('[Admin Buyers] Erro local:', localErrors)
      return NextResponse.json(
        { error: 'Erro ao buscar pagamentos locais', details: localErrors.map((error: any) => error.message).join(' | ') },
        { status: 500 }
      )
    }

    const composerIds = Array.from(new Set([
      ...(subscriptionsResult.data || []).map((row: any) => row.composer_id),
      ...(featuredResult.data || []).map((row: any) => row.composer_id),
      ...((topupsMissing ? [] : topupsResult.data) || []).map((row: any) => row.composer_id),
      ...(videosResult.data || []).map((row: any) => row.composer_id),
    ].filter(Boolean)))

    const composersById = await fetchComposersByIds(composerIds)

    // Source of truth: only DCC local paid records (not every payment in the MP account).
    const localPurchases = dedupeLocalPurchases([
      ...(subscriptionsResult.data || []).map((row: any) => mapLocalPayment(row, 'subscription', composersById)),
      ...(featuredResult.data || []).map((row: any) => mapLocalPayment(row, 'featured', composersById)),
      ...((topupsMissing ? [] : topupsResult.data) || []).map((row: any) => mapLocalPayment(row, 'studio_topup', composersById)),
      ...(videosResult.data || []).map((row: any) => mapLocalPayment(row, 'video', composersById)),
    ].filter(Boolean) as PurchaseRow[])

    const mpById = buildMpLookup(mpResult.payments || [])
    const purchases = enrichWithMercadoPago(localPurchases, mpById)
    const buyers = buildBuyers(purchases)
    const recurringBuyers = buyers.filter(buyer => buyer.isRecurring)
    const matchedWithMp = purchases.filter(purchase => mpById.has(purchase.paymentId)).length

    if (format === 'csv') {
      if (scope === 'recurring' || scope === 'recorrentes') {
        const csv = toCsv(
          ['email', 'phone', 'fn', 'ln', 'name', 'composer_id', 'purchase_count', 'total_amount', 'first_purchase_at', 'last_purchase_at', 'document'],
          recurringBuyers.map(buyer => ({
            email: buyer.email,
            phone: buyer.phone,
            fn: buyer.firstName,
            ln: buyer.lastName,
            name: buyer.name,
            composer_id: buyer.composerId,
            purchase_count: buyer.purchaseCount,
            total_amount: buyer.totalAmount,
            first_purchase_at: buyer.firstPurchaseAt || '',
            last_purchase_at: buyer.lastPurchaseAt || '',
            document: buyer.document,
          }))
        )
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="compradores-recorrentes.csv"',
          },
        })
      }

      if (scope === 'buyers' || scope === 'compradores') {
        const csv = toCsv(
          ['email', 'phone', 'fn', 'ln', 'name', 'composer_id', 'purchase_count', 'total_amount', 'is_recurring', 'first_purchase_at', 'last_purchase_at', 'document', 'payment_methods', 'sources'],
          buyers.map(buyer => ({
            email: buyer.email,
            phone: buyer.phone,
            fn: buyer.firstName,
            ln: buyer.lastName,
            name: buyer.name,
            composer_id: buyer.composerId,
            purchase_count: buyer.purchaseCount,
            total_amount: buyer.totalAmount,
            is_recurring: buyer.isRecurring ? 'sim' : 'nao',
            first_purchase_at: buyer.firstPurchaseAt || '',
            last_purchase_at: buyer.lastPurchaseAt || '',
            document: buyer.document,
            payment_methods: buyer.paymentMethods,
            sources: buyer.sources,
          }))
        )
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="compradores.csv"',
          },
        })
      }

      const csv = toCsv(
        ['payment_id', 'paid_at', 'amount', 'email', 'phone', 'fn', 'ln', 'name', 'composer_id', 'document', 'payment_method', 'source', 'external_reference', 'status'],
        purchases.map(purchase => ({
          payment_id: purchase.paymentId,
          paid_at: purchase.paidAt || '',
          amount: purchase.amount,
          email: purchase.email,
          phone: purchase.phone,
          fn: purchase.firstName,
          ln: purchase.lastName,
          name: purchase.name,
          composer_id: purchase.composerId,
          document: purchase.document,
          payment_method: purchase.paymentMethod,
          source: purchase.source,
          external_reference: purchase.externalReference,
          status: purchase.status,
        }))
      )
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="compras.csv"',
        },
      })
    }

    return NextResponse.json({
      period: {
        startDate: formatDayKey(startDate),
        endDate: formatDayKey(endDate),
      },
      mercadoPago: {
        configured: mpResult.configured,
        fetched: mpResult.payments.length,
        matchedLocal: matchedWithMp,
        pages: mpResult.pages,
        error: mpResult.error,
      },
      warnings: [
        ...(mpResult.error ? [`Mercado Pago: ${mpResult.error}`] : []),
        ...(topupsMissing ? ['Tabela de recargas Studio indisponível nesta base.'] : []),
        'Agora contamos só compras do DCC (assinatura, recarga, destaque e vídeo). O Mercado Pago só entra para enriquecer telefone/dados.',
        'Telefone só aparece quando o Mercado Pago gravou esse dado no pagamento.',
      ],
      totals: {
        purchases: purchases.length,
        buyers: buyers.length,
        recurringBuyers: recurringBuyers.length,
        amount: Number(purchases.reduce((sum, row) => sum + row.amount, 0).toFixed(2)),
        withPhone: buyers.filter(buyer => buyer.phone).length,
        withEmail: buyers.filter(buyer => buyer.email).length,
      },
      purchases,
      buyers,
      recurringBuyers,
    })
  } catch (error: any) {
    console.error('[Admin Buyers] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar relatório de compradores', details: error.message },
      { status: 500 }
    )
  }
}
