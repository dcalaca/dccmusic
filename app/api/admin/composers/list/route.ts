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

    if (!shouldExport) {
      const composers = await db.getAllComposers()
      const statsByComposer = await buildStatsForComposers(composers)
      const composersWithStats = composers.map((composer) => ({
        ...composer,
        ...(statsByComposer.get(composer.id) || createEmptyStats()),
      }))

      return NextResponse.json(composersWithStats)
    }

    const offset = Math.max(0, Number(searchParams.get('offset') || 0))
    const requestedLimit = Number(searchParams.get('limit') || 20)
    const limit = Math.min(50, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 20))
    const { data, error, count } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const chunk = (data || []).map(db.mapComposer)
    const statsByComposer = await buildStatsForComposers(chunk)
    const composersWithExportStats = chunk.map((composer) => ({
      ...emptyExportStats(composer),
      ...(statsByComposer.get(composer.id) || createEmptyStats()),
      ...composer,
    }))

    const total = count || offset + chunk.length
    const nextOffset = offset + chunk.length

    return NextResponse.json({
      items: composersWithExportStats,
      total,
      offset,
      limit,
      nextOffset,
      done: nextOffset >= total || chunk.length === 0,
    })
  } catch (error: any) {
    console.error('Erro ao buscar compositores:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar compositores', details: error.message },
      { status: 500 }
    )
  }
}
