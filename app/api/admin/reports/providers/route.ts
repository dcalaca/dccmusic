import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ProviderDay = {
  date: string
  label: string
  sunoapi: number
  mureka: number
  other: number
  total: number
}

type ProviderTotal = {
  provider: string
  label: string
  total: number
  completed: number
  processing: number
  firstReady: number
  failed: number
  versions: number
}

type QueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
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

function getDefaultRange() {
  const now = new Date()
  const today = formatDayKey(now)
  return {
    start: parseDateOnly(formatDayKey(addDays(new Date(`${today}T00:00:00-03:00`), -29)), now),
    end: parseDateOnly(today, now),
  }
}

function buildBuckets(startDate: Date, endExclusive: Date) {
  const buckets = new Map<string, ProviderDay>()
  let current = new Date(startDate)

  while (current < endExclusive) {
    const date = formatDayKey(current)
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      sunoapi: 0,
      mureka: 0,
      other: 0,
      total: 0,
    })
    current = addDays(current, 1)
  }

  return buckets
}

function providerLabel(provider: string) {
  if (provider === 'sunoapi') return 'Suno'
  if (provider === 'mureka') return 'Mureka'
  return provider || 'Outro'
}

function providerDayKey(provider: string): 'sunoapi' | 'mureka' | 'other' {
  if (provider === 'sunoapi' || provider === 'mureka') return provider
  return 'other'
}

async function fetchPaged<T>(makeQuery: (from: number, to: number) => PromiseLike<QueryResult<T>>) {
  const pageSize = 1000
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await makeQuery(from, to)
    if (error) throw error

    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
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

    const generations = await fetchPaged<any>((from, to) => supabaseAdmin
      .from('studio_generations')
      .select('id, provider, status, created_at')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })
      .range(from, to)
    )

    const totals = new Map<string, ProviderTotal>()
    const generationProvider = new Map<string, string>()

    for (const generation of generations) {
      const provider = generation.provider || 'other'
      const day = buckets.get(formatDayKey(new Date(generation.created_at)))
      const total = totals.get(provider) || {
        provider,
        label: providerLabel(provider),
        total: 0,
        completed: 0,
        processing: 0,
        firstReady: 0,
        failed: 0,
        versions: 0,
      }

      total.total += 1
      if (generation.status === 'completed') total.completed += 1
      else if (generation.status === 'first_ready') total.firstReady += 1
      else if (generation.status === 'failed') total.failed += 1
      else total.processing += 1

      totals.set(provider, total)
      generationProvider.set(generation.id, provider)

      if (day) {
        day[providerDayKey(provider)] += 1
        day.total += 1
      }
    }

    const generationIds = generations.map((generation) => generation.id)
    for (const ids of chunk(generationIds, 500)) {
      const versions = await fetchPaged<any>((from, to) => supabaseAdmin
        .from('studio_versions')
        .select('id, generation_id')
        .in('generation_id', ids)
        .range(from, to)
      )

      for (const version of versions) {
        const provider = generationProvider.get(version.generation_id)
        if (!provider) continue
        const total = totals.get(provider)
        if (total) total.versions += 1
      }
    }

    const days = Array.from(buckets.values())
    const providerTotals = Array.from(totals.values()).sort((a, b) => b.total - a.total)

    return NextResponse.json({
      period: {
        startDate: formatDayKey(startDate),
        endDate: formatDayKey(endDate),
      },
      days,
      providerTotals,
      totals: providerTotals.reduce((acc, item) => ({
        total: acc.total + item.total,
        completed: acc.completed + item.completed,
        processing: acc.processing + item.processing,
        firstReady: acc.firstReady + item.firstReady,
        failed: acc.failed + item.failed,
        versions: acc.versions + item.versions,
      }), {
        total: 0,
        completed: 0,
        processing: 0,
        firstReady: 0,
        failed: 0,
        versions: 0,
      }),
    })
  } catch (error: any) {
    console.error('[Admin Reports Providers] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular relatório por fornecedor', details: error.message },
      { status: 500 }
    )
  }
}
