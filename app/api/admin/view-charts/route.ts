import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ViewKind = 'music' | 'video'

type RankingItem = {
  id: string
  title: string
  slug: string
  views: number
}

type RankingResult = {
  ranking: RankingItem[]
  totalViews: number
}

type QueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

const TIME_ZONE = 'America/Sao_Paulo'
const PAGE_SIZE = 1000
const TOP_LIMIT = 20

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseDateOnly(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(`${value}T00:00:00-03:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function getDefaultRange() {
  const today = formatDayKey(new Date())
  const end = parseDateOnly(today, new Date())
  return {
    start: addDays(end, -29),
    end,
  }
}

async function fetchPaged<T>(makeQuery: (from: number, to: number) => PromiseLike<QueryResult<T>>) {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await makeQuery(from, to)
    if (error) throw error

    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function getRanking(kind: ViewKind, startIso: string, endIso: string): Promise<RankingResult> {
  const viewTable = kind === 'music' ? 'dccmusic_music_views' : 'dccmusic_video_views'
  const contentTable = kind === 'music' ? 'dccmusic_musics' : 'dccmusic_videos'
  const idColumn = kind === 'music' ? 'music_id' : 'video_id'

  // Por padrão exclui robôs/preview (não infla o ranking).
  // Se a coluna view_type ainda não existir (SQL não rodado), faz fallback sem o filtro.
  let rows: Record<string, string | null>[]
  try {
    rows = await fetchPaged<Record<string, string | null>>((from, to) => supabaseAdmin
      .from(viewTable)
      .select(idColumn)
      .gte('viewed_at', startIso)
      .lt('viewed_at', endIso)
      .neq('view_type', 'BOT_PREVIEW')
      .range(from, to)
    )
  } catch (error: any) {
    console.warn('[Admin View Charts] Filtro de bots indisponível, usando contagem sem filtro:', error?.message)
    rows = await fetchPaged<Record<string, string | null>>((from, to) => supabaseAdmin
      .from(viewTable)
      .select(idColumn)
      .gte('viewed_at', startIso)
      .lt('viewed_at', endIso)
      .range(from, to)
    )
  }

  const counts = new Map<string, number>()
  for (const row of rows) {
    const id = row[idColumn]
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([id]) => id)

  const totalViews = rows.length

  if (topIds.length === 0) {
    return {
      ranking: [],
      totalViews,
    }
  }

  const { data, error } = await supabaseAdmin
    .from(contentTable)
    .select('id, title, slug')
    .in('id', topIds)

  if (error) throw error

  const contentById = new Map((data || []).map((item: any) => [item.id, item]))

  const ranking = topIds.map(id => {
    const content = contentById.get(id)
    return {
      id,
      title: content?.title || (kind === 'music' ? '(música removida)' : '(vídeo removido)'),
      slug: content?.slug || '',
      views: counts.get(id) || 0,
    }
  })

  return {
    ranking,
    totalViews,
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

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'A data inicial não pode ser maior que a data final.' },
        { status: 400 }
      )
    }

    const [musics, videos] = await Promise.all([
      getRanking('music', startDate.toISOString(), endExclusive.toISOString()),
      getRanking('video', startDate.toISOString(), endExclusive.toISOString()),
    ])

    return NextResponse.json({
      period: {
        startDate: formatDayKey(startDate),
        endDate: formatDayKey(endDate),
      },
      musics: musics.ranking,
      videos: videos.ranking,
      totals: {
        musicViews: musics.totalViews,
        videoViews: videos.totalViews,
      },
    })
  } catch (error: any) {
    console.error('[Admin View Charts] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar gráficos de visualizações', details: error.message },
      { status: 500 }
    )
  }
}
