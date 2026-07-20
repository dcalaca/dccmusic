import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type PaymentSource = 'subscription' | 'featured' | 'studio_topup' | 'video'
type PaymentKind = 'new' | 'recurring'

type RawPayment = {
  id: string
  composerId: string
  amount: number
  paidAt: string
  source: PaymentSource
  label: string
  dedupeKey: string
}

type DayBucket = {
  date: string
  label: string
  newCount: number
  newAmount: number
  recurringCount: number
  recurringAmount: number
}

type KindSummary = {
  kind: PaymentKind
  label: string
  count: number
  amount: number
  uniqueComposers: number
}

type SourceBreakdown = {
  source: PaymentSource
  label: string
  newCount: number
  newAmount: number
  recurringCount: number
  recurringAmount: number
  totalCount: number
  totalAmount: number
}

const TIME_ZONE = 'America/Sao_Paulo'

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

function formatDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00-03:00`)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function toSaoPauloDayKey(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatDayKey(date)
}

function getDefaultRange() {
  const now = new Date()
  const today = formatDayKey(now)
  return {
    start: parseDateOnly(formatDayKey(addDays(new Date(`${today}T00:00:00-03:00`), -29)), now),
    end: parseDateOnly(today, now),
  }
}

function buildBuckets(startDate: Date, endExclusive: Date) {
  const buckets = new Map<string, DayBucket>()
  let current = new Date(startDate)

  while (current < endExclusive) {
    const date = formatDayKey(current)
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      newCount: 0,
      newAmount: 0,
      recurringCount: 0,
      recurringAmount: 0,
    })
    current = addDays(current, 1)
  }

  return buckets
}

function dedupeByKey<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = getKey(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

async function collectComposerIdsWithPriorPayments(composerIds: string[], beforeIso: string) {
  const prior = new Set<string>()
  if (composerIds.length === 0) return prior

  for (const ids of chunk(composerIds, 200)) {
    const [subscriptions, featured, topups, videos] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_payments')
        .select('composer_id')
        .eq('status', 'paid')
        .in('composer_id', ids)
        .lt('paid_at', beforeIso),
      supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('composer_id')
        .eq('payment_status', 'approved')
        .in('composer_id', ids)
        .lt('created_at', beforeIso),
      supabaseAdmin
        .from('studio_credit_topups')
        .select('composer_id')
        .eq('status', 'paid')
        .in('composer_id', ids)
        .lt('paid_at', beforeIso),
      supabaseAdmin
        .from('studio_video_requests')
        .select('composer_id')
        .gt('amount', 0)
        .not('paid_at', 'is', null)
        .in('composer_id', ids)
        .lt('paid_at', beforeIso),
    ])

    const topupsMissing = isMissingTableError(topups.error, 'studio_credit_topups')
    const errors = [
      subscriptions.error,
      featured.error,
      topupsMissing ? null : topups.error,
      videos.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      throw new Error(errors.map((error: any) => error.message).join(' | '))
    }

    for (const row of subscriptions.data || []) {
      if (row.composer_id) prior.add(row.composer_id)
    }
    for (const row of featured.data || []) {
      if (row.composer_id) prior.add(row.composer_id)
    }
    for (const row of topupsMissing ? [] : (topups.data || [])) {
      if (row.composer_id) prior.add(row.composer_id)
    }
    for (const row of videos.data || []) {
      if (row.composer_id) prior.add(row.composer_id)
    }
  }

  return prior
}

function emptySourceBreakdown(source: PaymentSource, label: string): SourceBreakdown {
  return {
    source,
    label,
    newCount: 0,
    newAmount: 0,
    recurringCount: 0,
    recurringAmount: 0,
    totalCount: 0,
    totalAmount: 0,
  }
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
    const buckets = buildBuckets(startDate, endExclusive)

    const [paymentsResult, featuredResult, topupsResult, videosResult] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_payments')
        .select('id, composer_id, subscription_id, amount, gateway_payment_id, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('id, composer_id, content_type, content_id, amount, created_at')
        .eq('payment_status', 'approved')
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_credit_topups')
        .select('id, composer_id, amount, payment_id, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('studio_video_requests')
        .select('id, composer_id, project_id, amount, payment_id, paid_at, created_at')
        .gt('amount', 0)
        .not('paid_at', 'is', null)
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
    ])

    const topupsMissing = isMissingTableError(topupsResult.error, 'studio_credit_topups')
    const errors = [
      paymentsResult.error,
      featuredResult.error,
      topupsMissing ? null : topupsResult.error,
      videosResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error('[Admin Payment Types] Erro ao buscar pagamentos:', errors)
      return NextResponse.json(
        { error: 'Erro ao calcular tipos de pagamento', details: errors.map((error: any) => error.message).join(' | ') },
        { status: 500 }
      )
    }

    const subscriptionPayments = dedupeByKey(paymentsResult.data || [], (payment: any) => (
      payment.gateway_payment_id
        ? `gateway:${payment.gateway_payment_id}`
        : `subscription:${payment.subscription_id || payment.composer_id}:${Number(payment.amount) || 0}:${payment.paid_at || payment.created_at || ''}`
    ))
    const featuredPayments = dedupeByKey(featuredResult.data || [], (payment: any) => (
      `featured:${payment.composer_id}:${payment.content_type}:${payment.content_id}:${Number(payment.amount) || 0}:${payment.created_at || ''}`
    ))
    const studioTopups = dedupeByKey(topupsMissing ? [] : (topupsResult.data || []), (payment: any) => (
      `topup:${payment.id || payment.payment_id}:${Number(payment.amount) || 0}`
    ))
    const videoPayments = dedupeByKey(videosResult.data || [], (payment: any) => (
      `video:${payment.id || payment.payment_id || payment.project_id}:${Number(payment.amount) || 0}:${payment.paid_at || payment.created_at || ''}`
    ))

    const rawPayments: RawPayment[] = [
      ...subscriptionPayments.map((payment: any) => ({
        id: payment.id,
        composerId: payment.composer_id,
        amount: Math.max(0, Number(payment.amount) || 0),
        paidAt: payment.paid_at || payment.created_at,
        source: 'subscription' as const,
        label: 'Assinatura',
        dedupeKey: payment.gateway_payment_id
          ? `gateway:${payment.gateway_payment_id}`
          : `subscription:${payment.id}`,
      })),
      ...featuredPayments.map((payment: any) => ({
        id: payment.id,
        composerId: payment.composer_id,
        amount: Math.max(0, Number(payment.amount) || 0),
        paidAt: payment.created_at,
        source: 'featured' as const,
        label: 'Destaque',
        dedupeKey: `featured:${payment.id}`,
      })),
      ...studioTopups.map((payment: any) => ({
        id: payment.id,
        composerId: payment.composer_id,
        amount: Math.max(0, Number(payment.amount) || 0),
        paidAt: payment.paid_at || payment.created_at,
        source: 'studio_topup' as const,
        label: 'Recarga Studio',
        dedupeKey: `topup:${payment.id}`,
      })),
      ...videoPayments.map((payment: any) => ({
        id: payment.id,
        composerId: payment.composer_id,
        amount: Math.max(0, Number(payment.amount) || 0),
        paidAt: payment.paid_at || payment.created_at,
        source: 'video' as const,
        label: 'Vídeo',
        dedupeKey: `video:${payment.id}`,
      })),
    ]
      .filter(payment => payment.composerId && payment.paidAt)
      .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())

    const composerIds = Array.from(new Set(rawPayments.map(payment => payment.composerId)))
    const composersWithHistory = await collectComposerIdsWithPriorPayments(composerIds, startIso)
    const composersSeenInPeriod = new Set<string>()

    const kindSummaries: Record<PaymentKind, KindSummary> = {
      new: {
        kind: 'new',
        label: 'Pagamento novo',
        count: 0,
        amount: 0,
        uniqueComposers: 0,
      },
      recurring: {
        kind: 'recurring',
        label: 'Pagamento recorrente',
        count: 0,
        amount: 0,
        uniqueComposers: 0,
      },
    }

    const sourceMap = new Map<PaymentSource, SourceBreakdown>([
      ['subscription', emptySourceBreakdown('subscription', 'Assinatura')],
      ['featured', emptySourceBreakdown('featured', 'Destaque')],
      ['studio_topup', emptySourceBreakdown('studio_topup', 'Recarga Studio')],
      ['video', emptySourceBreakdown('video', 'Vídeo')],
    ])

    const newComposerIds = new Set<string>()
    const recurringComposerIds = new Set<string>()

    for (const payment of rawPayments) {
      const alreadyPaidBefore = composersWithHistory.has(payment.composerId) || composersSeenInPeriod.has(payment.composerId)
      const kind: PaymentKind = alreadyPaidBefore ? 'recurring' : 'new'
      composersSeenInPeriod.add(payment.composerId)

      const summary = kindSummaries[kind]
      summary.count += 1
      summary.amount += payment.amount

      if (kind === 'new') newComposerIds.add(payment.composerId)
      else recurringComposerIds.add(payment.composerId)

      const source = sourceMap.get(payment.source)
      if (source) {
        if (kind === 'new') {
          source.newCount += 1
          source.newAmount += payment.amount
        } else {
          source.recurringCount += 1
          source.recurringAmount += payment.amount
        }
        source.totalCount += 1
        source.totalAmount += payment.amount
      }

      const dayKey = toSaoPauloDayKey(payment.paidAt)
      const day = dayKey ? buckets.get(dayKey) : null
      if (day) {
        if (kind === 'new') {
          day.newCount += 1
          day.newAmount += payment.amount
        } else {
          day.recurringCount += 1
          day.recurringAmount += payment.amount
        }
      }
    }

    kindSummaries.new.uniqueComposers = newComposerIds.size
    kindSummaries.recurring.uniqueComposers = recurringComposerIds.size

    const comparison = [
      {
        key: 'new',
        label: 'Novos',
        count: kindSummaries.new.count,
        amount: kindSummaries.new.amount,
      },
      {
        key: 'recurring',
        label: 'Recorrentes',
        count: kindSummaries.recurring.count,
        amount: kindSummaries.recurring.amount,
      },
    ]

    return NextResponse.json({
      period: {
        startDate: formatDayKey(startDate),
        endDate: formatDayKey(endDate),
      },
      definitions: {
        new: 'Primeiro pagamento aprovado do compositor (assinatura, recarga, destaque ou vídeo).',
        recurring: 'Pagamento de quem já tinha pago antes (renovação ou nova compra do mesmo usuário).',
      },
      comparison,
      kinds: [kindSummaries.new, kindSummaries.recurring],
      bySource: Array.from(sourceMap.values()).filter(item => item.totalCount > 0),
      days: Array.from(buckets.values()),
      totals: {
        count: kindSummaries.new.count + kindSummaries.recurring.count,
        amount: kindSummaries.new.amount + kindSummaries.recurring.amount,
        uniqueComposers: composersSeenInPeriod.size,
      },
      warnings: topupsMissing ? ['Tabela de recargas Studio indisponível nesta base.'] : [],
    })
  } catch (error: any) {
    console.error('[Admin Payment Types] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular tipos de pagamento', details: error.message },
      { status: 500 }
    )
  }
}
