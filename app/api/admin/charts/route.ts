import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ChartDay = {
  date: string
  label: string
  musicRequestsCompleted: number
  lyricsCreated: number
  coversDefault: number
  coversPremium: number
  coversCustom: number
  voicesUploaded: number
  voicesCompleted: number
  composerRegistrations: number
  siteUserRegistrations: number
  totalRegistrations: number
}

type QueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

type NumericChartDayKey = {
  [K in keyof ChartDay]: ChartDay[K] extends number ? K : never
}[keyof ChartDay]

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
  const buckets = new Map<string, ChartDay>()
  let current = new Date(startDate)

  while (current < endExclusive) {
    const date = formatDayKey(current)
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      musicRequestsCompleted: 0,
      lyricsCreated: 0,
      coversDefault: 0,
      coversPremium: 0,
      coversCustom: 0,
      voicesUploaded: 0,
      voicesCompleted: 0,
      composerRegistrations: 0,
      siteUserRegistrations: 0,
      totalRegistrations: 0,
    })
    current = addDays(current, 1)
  }

  return buckets
}

function addToBucket(buckets: Map<string, ChartDay>, value: string | null | undefined, field: NumericChartDayKey) {
  if (!value) return
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return
  const bucket = buckets.get(formatDayKey(date))
  if (!bucket) return
  bucket[field] += 1
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

async function safeFetchPaged<T>(
  label: string,
  makeQuery: (from: number, to: number) => PromiseLike<QueryResult<T>>
) {
  try {
    return {
      rows: await fetchPaged(makeQuery),
      warning: null as string | null,
    }
  } catch (error: any) {
    console.error(`[Admin Charts] ${label}:`, error)
    return {
      rows: [] as T[],
      warning: `${label}: ${error?.message || 'não foi possível consultar'}`,
    }
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

    const [
      musicRequests,
      lyrics,
      covers,
      customCovers,
      voicesUploaded,
      voicesCompleted,
      composers,
      siteUsers,
    ] = await Promise.all([
      safeFetchPaged<any>('Músicas concluídas', (from, to) => supabaseAdmin
        .from('studio_generations')
        .select('id, updated_at')
        .eq('status', 'completed')
        .gte('updated_at', startIso)
        .lt('updated_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Letras', (from, to) => supabaseAdmin
        .from('studio_lyrics')
        .select('id, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Capas padrão e premium', (from, to) => supabaseAdmin
        .from('studio_covers')
        .select('id, is_premium, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Capas personalizadas', (from, to) => supabaseAdmin
        .from('studio_credit_transactions')
        .select('id, created_at')
        .eq('action', 'studio_cover_art')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Vozes subidas', (from, to) => supabaseAdmin
        .from('studio_voice_profiles')
        .select('id, created_at')
        .not('source_audio_path', 'is', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Vozes concluídas', (from, to) => supabaseAdmin
        .from('studio_voice_profiles')
        .select('id, updated_at')
        .eq('status', 'ready')
        .eq('is_available', true)
        .gte('updated_at', startIso)
        .lt('updated_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Cadastros de compositores', (from, to) => supabaseAdmin
        .from('dccmusic_composers')
        .select('id, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
      safeFetchPaged<any>('Cadastros de usuários do site', (from, to) => supabaseAdmin
        .from('dccmusic_site_users')
        .select('id, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .range(from, to)
      ),
    ])

    for (const row of musicRequests.rows) addToBucket(buckets, row.updated_at, 'musicRequestsCompleted')
    for (const row of lyrics.rows) addToBucket(buckets, row.created_at, 'lyricsCreated')
    for (const row of covers.rows) {
      addToBucket(buckets, row.created_at, row.is_premium ? 'coversPremium' : 'coversDefault')
    }
    for (const row of customCovers.rows) addToBucket(buckets, row.created_at, 'coversCustom')
    for (const row of voicesUploaded.rows) addToBucket(buckets, row.created_at, 'voicesUploaded')
    for (const row of voicesCompleted.rows) addToBucket(buckets, row.updated_at, 'voicesCompleted')
    for (const row of composers.rows) addToBucket(buckets, row.created_at, 'composerRegistrations')
    for (const row of siteUsers.rows) addToBucket(buckets, row.created_at, 'siteUserRegistrations')

    const days = Array.from(buckets.values()).map(day => ({
      ...day,
      totalRegistrations: day.composerRegistrations + day.siteUserRegistrations,
    }))

    return NextResponse.json({
      period: {
        startDate: formatDayKey(startDate),
        endDate: formatDayKey(endDate),
      },
      days,
      totals: days.reduce((totals, day) => ({
        musicRequestsCompleted: totals.musicRequestsCompleted + day.musicRequestsCompleted,
        lyricsCreated: totals.lyricsCreated + day.lyricsCreated,
        coversDefault: totals.coversDefault + day.coversDefault,
        coversPremium: totals.coversPremium + day.coversPremium,
        coversCustom: totals.coversCustom + day.coversCustom,
        voicesUploaded: totals.voicesUploaded + day.voicesUploaded,
        voicesCompleted: totals.voicesCompleted + day.voicesCompleted,
        composerRegistrations: totals.composerRegistrations + day.composerRegistrations,
        siteUserRegistrations: totals.siteUserRegistrations + day.siteUserRegistrations,
        totalRegistrations: totals.totalRegistrations + day.totalRegistrations,
      }), {
        musicRequestsCompleted: 0,
        lyricsCreated: 0,
        coversDefault: 0,
        coversPremium: 0,
        coversCustom: 0,
        voicesUploaded: 0,
        voicesCompleted: 0,
        composerRegistrations: 0,
        siteUserRegistrations: 0,
        totalRegistrations: 0,
      }),
      warnings: [
        musicRequests.warning,
        lyrics.warning,
        covers.warning,
        customCovers.warning,
        voicesUploaded.warning,
        voicesCompleted.warning,
        composers.warning,
        siteUsers.warning,
      ].filter(Boolean),
    })
  } catch (error: any) {
    console.error('[Admin Charts] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar gráficos do admin', details: error.message },
      { status: 500 }
    )
  }
}
