import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })

  const rawPage = Number(request.nextUrl.searchParams.get('page') || '0')
  if (!Number.isSafeInteger(rawPage) || rawPage < 0 || rawPage > 10000) {
    return NextResponse.json({ errorCode: 'invalidPage' }, { status: 400 })
  }

  try {
    // Read only text and titles, without generating signed audio/cover URLs.
    // Both ownership filters are needed because this client bypasses RLS.
    const { data, error } = await supabaseAdmin
      .from('studio_projects')
      .select('id, title, studio_lyrics!inner(id, content, updated_at, created_at)')
      .eq('composer_id', composer.composerId)
      .eq('studio_lyrics.composer_id', composer.composerId)
      .eq('studio_lyrics.is_current', true)
      .neq('studio_lyrics.content', '')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .order('created_at', { referencedTable: 'studio_lyrics', ascending: false })
      .order('id', { referencedTable: 'studio_lyrics', ascending: false })
      .limit(1, { referencedTable: 'studio_lyrics' })
      .range(rawPage * PAGE_SIZE, rawPage * PAGE_SIZE + PAGE_SIZE)
    if (error) throw error

    const rows = data || []
    const lyrics = rows.slice(0, PAGE_SIZE).map((row: any) => ({
      id: row.studio_lyrics[0].id,
      projectId: row.id,
      title: row.title,
      content: row.studio_lyrics[0].content,
      updatedAt: row.studio_lyrics[0].updated_at,
    }))
    return NextResponse.json({ lyrics, hasMore: rows.length > PAGE_SIZE }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[Studio IA] Error loading saved lyrics:', error)
    return NextResponse.json({ errorCode: 'load' }, { status: 500 })
  }
}
