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

function mapMpPayment(payment: any): PurchaseRow | null {
  const status = String(payment?.status || '').toLowerCase()
  if (status !== 'approved') return null

  const email = extractEmail(payment)
  const name = extractName(payment)
  const { firstName, lastName } = splitName(name)
  const amount = Number(payment?.transaction_amount || payment?.transaction_details?.total_paid_amount || 0) || 0
  const paymentId = String(payment?.id || '')
  if (!paymentId && !email) return null

  return {
    paymentId: paymentId || `mp-${email}-${payment?.date_approved || payment?.date_created || ''}`,
    paidAt: payment?.date_approved || payment?.date_created || null,
    amount,
    status: status || 'approved',
    paymentMethod: String(payment?.payment_method_id || payment?.payment_type_id || ''),
    source: 'mercadopago',
    email,
    name,
    firstName,
    lastName,
    phone: extractPhone(payment),
    document: extractDocument(payment),
    externalReference: String(payment?.external_reference || ''),
    composerId: String(payment?.metadata?.composer_id || ''),
  }
}

function mapLocalPayment(row: any, source: string, composersById: Map<string, any>): PurchaseRow | null {
  const payload = row.gateway_response || row.metadata?.mercadopago_payment || row.metadata || {}
  const composer = composersById.get(row.composer_id)
  const email = extractEmail(payload) || normalizeEmail(composer?.email)
  const name = extractName(payload, composer?.name || '')
  const { firstName, lastName } = splitName(name)
  const amount = Math.max(0, Number(row.amount) || 0)
  const paymentId = String(
    row.gateway_payment_id ||
    payload?.id ||
    row.payment_id ||
    `${source}:${row.id}`
  )

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

function mergePurchases(rows: PurchaseRow[]) {
  const byId = new Map<string, PurchaseRow>()

  for (const row of rows) {
    if (!row.paymentId && !row.email) continue
    const key = row.paymentId || `${row.email}:${row.paidAt}:${row.amount}:${row.source}`
    const current = byId.get(key)
    if (!current) {
      byId.set(key, row)
      continue
    }

    byId.set(key, {
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
    })
  }

  return Array.from(byId.values()).sort((a, b) => {
    const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0
    const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0
    return dateB - dateA
  })
}

function buildBuyers(purchases: PurchaseRow[]): BuyerRow[] {
  const map = new Map<string, BuyerRow & { methods: Set<string>; sourceSet: Set<string> }>()

  for (const purchase of purchases) {
    const key = purchase.email || purchase.phone || purchase.composerId || purchase.paymentId
    if (!key) continue

    const current = map.get(key)
    if (!current) {
      map.set(key, {
        email: purchase.email,
        name: purchase.name,
        firstName: purchase.firstName,
        lastName: purchase.lastName,
        phone: purchase.phone,
        document: purchase.document,
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

    const composersResult = composerIds.length > 0
      ? await supabaseAdmin.from('dccmusic_composers').select('id, name, email').in('id', composerIds)
      : { data: [], error: null }

    if (composersResult.error) {
      return NextResponse.json(
        { error: 'Erro ao buscar compositores', details: composersResult.error.message },
        { status: 500 }
      )
    }

    const composersById = new Map((composersResult.data || []).map((row: any) => [row.id, row]))

    const localPurchases = [
      ...(subscriptionsResult.data || []).map((row: any) => mapLocalPayment(row, 'subscription', composersById)),
      ...(featuredResult.data || []).map((row: any) => mapLocalPayment(row, 'featured', composersById)),
      ...((topupsMissing ? [] : topupsResult.data) || []).map((row: any) => mapLocalPayment(row, 'studio_topup', composersById)),
      ...(videosResult.data || []).map((row: any) => mapLocalPayment(row, 'video', composersById)),
    ].filter(Boolean) as PurchaseRow[]

    const mpPurchases = (mpResult.payments || [])
      .map(mapMpPayment)
      .filter(Boolean) as PurchaseRow[]

    // Enrich MP rows with composer email/name when only composer_id exists
    for (const purchase of mpPurchases) {
      if (purchase.composerId && composersById.has(purchase.composerId)) {
        const composer = composersById.get(purchase.composerId)
        if (!purchase.email) purchase.email = normalizeEmail(composer.email)
        if (!purchase.name) {
          purchase.name = String(composer.name || '')
          const parts = splitName(purchase.name)
          purchase.firstName = parts.firstName
          purchase.lastName = parts.lastName
        }
      }
    }

    // Also try matching local composers by email for MP-only rows
    const emails = Array.from(new Set(mpPurchases.map(row => row.email).filter(Boolean)))
    if (emails.length > 0) {
      const byEmailResult = await supabaseAdmin
        .from('dccmusic_composers')
        .select('id, name, email')
        .in('email', emails)

      if (!byEmailResult.error && byEmailResult.data) {
        const composersByEmail = new Map(
          byEmailResult.data.map((row: any) => [normalizeEmail(row.email), row])
        )
        for (const purchase of mpPurchases) {
          const composer = composersByEmail.get(purchase.email)
          if (!composer) continue
          if (!purchase.name) {
            purchase.name = String(composer.name || '')
            const parts = splitName(purchase.name)
            purchase.firstName = parts.firstName
            purchase.lastName = parts.lastName
          }
          if (!purchase.composerId) purchase.composerId = composer.id
        }
      }
    }

    const purchases = mergePurchases([...mpPurchases, ...localPurchases])
      .filter(row => row.status === 'approved' || row.status === 'accredited' || !row.status)
    const buyers = buildBuyers(purchases)
    const recurringBuyers = buyers.filter(buyer => buyer.isRecurring)

    if (format === 'csv') {
      if (scope === 'recurring' || scope === 'recorrentes') {
        const csv = toCsv(
          ['email', 'phone', 'fn', 'ln', 'name', 'purchase_count', 'total_amount', 'first_purchase_at', 'last_purchase_at', 'document'],
          recurringBuyers.map(buyer => ({
            email: buyer.email,
            phone: buyer.phone,
            fn: buyer.firstName,
            ln: buyer.lastName,
            name: buyer.name,
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
            'Content-Disposition': `attachment; filename="compradores-recorrentes.csv"`,
          },
        })
      }

      if (scope === 'buyers' || scope === 'compradores') {
        const csv = toCsv(
          ['email', 'phone', 'fn', 'ln', 'name', 'purchase_count', 'total_amount', 'is_recurring', 'first_purchase_at', 'last_purchase_at', 'document', 'payment_methods', 'sources'],
          buyers.map(buyer => ({
            email: buyer.email,
            phone: buyer.phone,
            fn: buyer.firstName,
            ln: buyer.lastName,
            name: buyer.name,
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
            'Content-Disposition': `attachment; filename="compradores.csv"`,
          },
        })
      }

      const csv = toCsv(
        ['payment_id', 'paid_at', 'amount', 'email', 'phone', 'fn', 'ln', 'name', 'document', 'payment_method', 'source', 'external_reference', 'status'],
        purchases.map(purchase => ({
          payment_id: purchase.paymentId,
          paid_at: purchase.paidAt || '',
          amount: purchase.amount,
          email: purchase.email,
          phone: purchase.phone,
          fn: purchase.firstName,
          ln: purchase.lastName,
          name: purchase.name,
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
          'Content-Disposition': `attachment; filename="compras.csv"`,
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
        pages: mpResult.pages,
        error: mpResult.error,
      },
      warnings: [
        ...(mpResult.error ? [`Mercado Pago: ${mpResult.error}`] : []),
        ...(topupsMissing ? ['Tabela de recargas Studio indisponível nesta base.'] : []),
        'Telefone só aparece quando o Mercado Pago gravou esse dado no pagamento. Muitos checkouts não enviam telefone.',
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
