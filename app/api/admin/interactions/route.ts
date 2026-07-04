import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

type ContentType = 'music' | 'video' | 'studio_music'

type ContentInfo = {
  title: string
  slug?: string | null
  url?: string | null
}

const contentTypeLabels: Record<ContentType, string> = {
  music: 'Música',
  video: 'Vídeo',
  studio_music: 'Studio IA',
}

function getContentUrl(contentType: ContentType, slug?: string | null) {
  if (!slug) return null
  if (contentType === 'music') return `/musicas/${slug}`
  if (contentType === 'video') return `/videos/${slug}`
  return `/studio/${slug}`
}

async function getUsersMap(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, any>()

  const { data, error } = await supabaseAdmin
    .from('dccmusic_site_users')
    .select('id, name, email, first_name')
    .in('id', userIds)

  if (error) throw error
  return new Map((data || []).map((user: any) => [user.id, user]))
}

async function getContentMap(rows: Array<{ content_type: ContentType; content_id: string }>) {
  const map = new Map<string, ContentInfo>()
  const grouped: Record<ContentType, string[]> = {
    music: [],
    video: [],
    studio_music: [],
  }

  rows.forEach((row) => {
    if (!grouped[row.content_type]) return
    grouped[row.content_type].push(row.content_id)
  })

  const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

  const [musics, videos, studioProjects] = await Promise.all([
    unique(grouped.music).length
      ? supabaseAdmin.from('dccmusic_musics').select('id, title, slug').in('id', unique(grouped.music))
      : Promise.resolve({ data: [], error: null }),
    unique(grouped.video).length
      ? supabaseAdmin.from('dccmusic_videos').select('id, title, slug').in('id', unique(grouped.video))
      : Promise.resolve({ data: [], error: null }),
    unique(grouped.studio_music).length
      ? supabaseAdmin.from('studio_projects').select('id, title, public_slug').in('id', unique(grouped.studio_music))
      : Promise.resolve({ data: [], error: null }),
  ])

  if (musics.error) throw musics.error
  if (videos.error) throw videos.error
  if (studioProjects.error) throw studioProjects.error

  ;(musics.data || []).forEach((item: any) => {
    map.set(`music:${item.id}`, {
      title: item.title || 'Música sem título',
      slug: item.slug,
      url: getContentUrl('music', item.slug),
    })
  })

  ;(videos.data || []).forEach((item: any) => {
    map.set(`video:${item.id}`, {
      title: item.title || 'Vídeo sem título',
      slug: item.slug,
      url: getContentUrl('video', item.slug),
    })
  })

  ;(studioProjects.data || []).forEach((item: any) => {
    map.set(`studio_music:${item.id}`, {
      title: item.title || 'Música Studio sem título',
      slug: item.public_slug,
      url: getContentUrl('studio_music', item.public_slug),
    })
  })

  return map
}

function mapUser(user: any) {
  const formattedName = user?.name ? formatDisplayName(user.name) : 'Usuário removido'
  return {
    name: formattedName,
    firstName: user?.first_name ? formatDisplayName(user.first_name) : formattedName.split(' ')[0] || 'Usuário',
    email: user?.email || null,
  }
}

function mapContent(contentType: ContentType, contentId: string, contentMap: Map<string, ContentInfo>) {
  const content = contentMap.get(`${contentType}:${contentId}`)
  return {
    type: contentType,
    typeLabel: contentTypeLabels[contentType] || contentType,
    id: contentId,
    title: content?.title || 'Conteúdo não encontrado',
    url: content?.url || null,
  }
}

export async function GET() {
  try {
    await requireAuth()

    const [{ data: comments, error: commentsError }, { data: ratings, error: ratingsError }] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_comments')
        .select('id, user_id, content_type, content_id, comment, is_approved, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('dccmusic_ratings')
        .select('id, user_id, content_type, content_id, rating, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(250),
    ])

    if (commentsError) throw commentsError
    if (ratingsError) throw ratingsError

    const allRows = [...(comments || []), ...(ratings || [])]
    const userIds = [...new Set(allRows.map((row: any) => row.user_id).filter(Boolean))]

    const [usersMap, contentMap] = await Promise.all([
      getUsersMap(userIds),
      getContentMap(allRows as Array<{ content_type: ContentType; content_id: string }>),
    ])

    const mappedComments = (comments || []).map((comment: any) => ({
      id: comment.id,
      user: mapUser(usersMap.get(comment.user_id)),
      content: mapContent(comment.content_type, comment.content_id, contentMap),
      comment: comment.comment,
      isApproved: comment.is_approved !== false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }))

    const mappedRatings = (ratings || []).map((rating: any) => ({
      id: rating.id,
      user: mapUser(usersMap.get(rating.user_id)),
      content: mapContent(rating.content_type, rating.content_id, contentMap),
      rating: Number(rating.rating) || 0,
      createdAt: rating.created_at,
      updatedAt: rating.updated_at,
    }))

    return NextResponse.json({
      comments: mappedComments,
      ratings: mappedRatings,
      stats: {
        totalComments: mappedComments.length,
        approvedComments: mappedComments.filter((comment: any) => comment.isApproved).length,
        hiddenComments: mappedComments.filter((comment: any) => !comment.isApproved).length,
        totalRatings: mappedRatings.length,
        averageRating: mappedRatings.length
          ? Math.round((mappedRatings.reduce((sum: number, rating: any) => sum + rating.rating, 0) / mappedRatings.length) * 10) / 10
          : 0,
      },
    })
  } catch (error: any) {
    console.error('[Admin Interactions] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar comentários e notas' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const id = String(body?.id || '')
    const isApproved = Boolean(body?.isApproved)

    if (!id) return NextResponse.json({ error: 'Comentário não informado.' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('dccmusic_comments')
      .update({
        is_approved: isApproved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Interactions Update] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar comentário' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Item não informado.' }, { status: 400 })
    if (kind !== 'comment' && kind !== 'rating') {
      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 })
    }

    const table = kind === 'comment' ? 'dccmusic_comments' : 'dccmusic_ratings'
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Interactions Delete] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao excluir item' }, { status: 500 })
  }
}
