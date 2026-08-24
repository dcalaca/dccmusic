import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ComposerExportStats = {
  videoCount: number
  musicCount: number
  totalViews: number
  studioLyricCount: number
  studioMusicCount: number
}

const ADMIN_COMPOSER_STATUSES = new Set(['all', 'active', 'inactive', 'studio', 'pending'])

function normalizeCountry(value: string | null) {
  const code = String(value || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

function createEmptyStats(): ComposerExportStats {
  return {
    videoCount: 0,
    musicCount: 0,
    totalViews: 0,
    studioLyricCount: 0,
    studioMusicCount: 0,
  }
}

async function safeRows<T = any>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    console.warn(`[ADMIN COMPOSERS] Falha ao buscar ${label}:`, error.message || error)
    return []
  }
  return data || []
}

function uniqueValues(rows: any[], key: string) {
  return Array.from(new Set(rows.map((row) => row[key]).filter(Boolean)))
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function collectStudioComposerIds() {
  const [lyrics, generations] = await Promise.all([
    safeRows('compositores com letras Studio', supabaseAdmin.from('studio_lyrics').select('composer_id')),
    safeRows('compositores com músicas Studio', supabaseAdmin.from('studio_generations').select('composer_id').neq('status', 'failed')),
  ])

  return Array.from(new Set([
    ...lyrics.map((row: any) => row.composer_id),
    ...generations.map((row: any) => row.composer_id),
  ].filter(Boolean)))
}

function applyStatusFilter(query: any, status: db.AdminComposerStatusFilter, studioComposerIds?: string[]) {
  const now = new Date().toISOString()

  if (status === 'active') {
    return query
      .eq('has_active_subscription', true)
      .eq('is_premium', true)
      .or(`subscription_expires_at.is.null,subscription_expires_at.gt.${now}`)
  }

  if (status === 'inactive') {
    return query.or(
      `has_active_subscription.eq.false,is_premium.eq.false,and(subscription_expires_at.not.is.null,subscription_expires_at.lt.${now})`
    )
  }

  if (status === 'pending') {
    return query.not('email', 'is', null).eq('email_verified', false)
  }

  if (status === 'studio') {
    const ids = studioComposerIds || []
    if (ids.length === 0) return query.in('id', ['00000000-0000-0000-0000-000000000000'])
    return query.in('id', ids)
  }

  return query
}

async function listComposersByCountry(options: {
  page: number
  limit: number
  search: string
  status: db.AdminComposerStatusFilter
  country: string
}) {
  const page = Math.max(1, options.page)
  const limit = Math.min(100, Math.max(1, options.limit))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const studioComposerIds = options.status === 'studio' ? await collectStudioComposerIds() : undefined

  let query = supabaseAdmin
    .from('dccmusic_composers')
    .select('*', { count: 'exact' })
    .ilike('country', options.country)
    .order('created_at', { ascending: false })

  if (options.search) {
    const safeSearch = options.search.replace(/[%_,]/g, '')
    const pattern = `%${safeSearch}%`
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},slug.ilike.${pattern}`)
  }

  query = applyStatusFilter(query, options.status, studioComposerIds)
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return {
    items: (data || []).map(db.mapComposer),
    total: count || 0,
    page,
    limit,
  }
}

async function buildStatsForComposers(composers: db.Composer[]) {
  const ids = composers.map((composer) => composer.id)
  const statsByComposer = new Map(ids.map((id) => [id, createEmptyStats()]))
  if (ids.length === 0) return statsByComposer

  for (const idChunk of chunk(ids, 80)) {
    const [
      musicRelations,
      videoRelations,
      lyrics,
      studioGenerations,
    ] = await Promise.all([
      safeRows('relações de músicas', supabaseAdmin.from('dccmusic_music_composers').select('composer_id, music_id').in('composer_id', idChunk)),
      safeRows('relações de vídeos', supabaseAdmin.from('dccmusic_video_composers').select('composer_id, video_id').in('composer_id', idChunk)),
      safeRows('letras Studio', supabaseAdmin.from('studio_lyrics').select('composer_id').in('composer_id', idChunk)),
      safeRows('músicas Studio', supabaseAdmin.from('studio_generations').select('composer_id, status').in('composer_id', idChunk).neq('status', 'failed')),
    ])

    musicRelations.forEach((row: any) => {
      const stats = statsByComposer.get(row.composer_id)
      if (stats) stats.musicCount += 1
    })
    videoRelations.forEach((row: any) => {
      const stats = statsByComposer.get(row.composer_id)
      if (stats) stats.videoCount += 1
    })
    lyrics.forEach((row: any) => {
      const stats = statsByComposer.get(row.composer_id)
      if (stats) stats.studioLyricCount += 1
    })
    studioGenerations.forEach((row: any) => {
      const stats = statsByComposer.get(row.composer_id)
      if (stats) stats.studioMusicCount += 1
    })

    const videoIds = uniqueValues(videoRelations, 'video_id')
    const videos = videoIds.length > 0
      ? (await Promise.all(chunk(videoIds, 100).map((videoChunk) => (
          safeRows('visualizações de vídeos', supabaseAdmin.from('dccmusic_videos').select('id, view_count').in('id', videoChunk))
        )))).flat()
      : []

    const videoViewsById = new Map(videos.map((video: any) => [video.id, Number(video.view_count) || 0]))
    videoRelations.forEach((row: any) => {
      const stats = statsByComposer.get(row.composer_id)
      if (stats) stats.totalViews += videoViewsById.get(row.video_id) || 0
    })
  }

  return statsByComposer
}

function emptyExportStats(composer: any) {
  return {
    ...composer,
    ...createEmptyStats(),
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shouldExport = searchParams.get('export') === '1'
    const country = normalizeCountry(searchParams.get('country'))

    if (!shouldExport) {
      const page = Math.max(1, Number(searchParams.get('page') || 1))
      const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 100)))
      const search = String(searchParams.get('search') || '').trim()
      const status = (searchParams.get('status') || 'all') as db.AdminComposerStatusFilter
      const safeStatus = ADMIN_COMPOSER_STATUSES.has(status) ? status : 'all'

      const [listed, summary] = await Promise.all([
        country
          ? listComposersByCountry({ page, limit, search, status: safeStatus, country })
          : db.listAdminComposers({ page, limit, search, status: safeStatus }),
        db.getAdminComposersSummary(),
      ])

      const statsByComposer = await buildStatsForComposers(listed.items)
      const composersWithStats = listed.items.map((composer) => ({
        ...composer,
        ...(statsByComposer.get(composer.id) || createEmptyStats()),
      }))

      const totalPages = Math.max(1, Math.ceil(listed.total / listed.limit))

      return NextResponse.json({
        items: composersWithStats,
        total: listed.total,
        page: listed.page,
        limit: listed.limit,
        totalPages,
        summary,
      })
    }

    const offset = Math.max(0, Number(searchParams.get('offset') || 0))
    const requestedLimit = Number(searchParams.get('limit') || 20)
    const limit = Math.min(50, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 20))

    let exportQuery = supabaseAdmin
      .from('dccmusic_composers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (country) {
      exportQuery = exportQuery.ilike('country', country)
    }

    const { data, error, count } = await exportQuery
    if (error) throw error

    const exportChunk = (data || []).map(db.mapComposer)
    const statsByComposer = await buildStatsForComposers(exportChunk)
    const composersWithExportStats = exportChunk.map((composer) => ({
      ...emptyExportStats(composer),
      ...(statsByComposer.get(composer.id) || createEmptyStats()),
      ...composer,
    }))

    const total = count || offset + exportChunk.length
    const nextOffset = offset + exportChunk.length

    return NextResponse.json({
      items: composersWithExportStats,
      total,
      offset,
      limit,
      nextOffset,
      done: nextOffset >= total || exportChunk.length === 0,
    })
  } catch (error: any) {
    console.error('Erro ao buscar compositores:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar compositores', details: error.message },
      { status: 500 }
    )
  }
}
