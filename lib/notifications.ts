import { supabaseAdmin } from './supabase'
import { createDccI18n } from '@/i18n'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export type NotificationType = 'comment' | 'reply' | 'comment_like' | 'new_music'

type ContentType = 'music' | 'video' | 'studio_music'

async function getNotificationTranslator(composerId: string) {
  const { data } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('country')
    .eq('id', composerId)
    .maybeSingle()
  const i18n = await createDccI18n(getLocaleForCountry(normalizeCountry(data?.country)))
  return i18n.t.bind(i18n)
}

export async function createNotification(input: {
  composerId: string
  type: NotificationType
  title: string
  body?: string | null
  href?: string | null
  actorName?: string | null
  eventKey?: string | null
}) {
  if (!input.composerId) return

  const { error } = await supabaseAdmin.from('dccmusic_notifications').insert({
    composer_id: input.composerId,
    type: input.type,
    title: input.title,
    body: input.body || null,
    href: input.href || null,
    actor_name: input.actorName || null,
    event_key: input.eventKey || null,
  })

  if (error?.code === '23505') return
  if (error) {
    console.error('[NOTIFICATIONS] Erro ao criar notificação:', error.message)
  }
}

export async function getComposerIdBySiteUserId(siteUserId: string): Promise<string | null> {
  const { data: user, error: userError } = await supabaseAdmin
    .from('dccmusic_site_users')
    .select('email')
    .eq('id', siteUserId)
    .maybeSingle()

  if (userError || !user?.email) return null

  const { data: composer, error: composerError } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id')
    .eq('email', user.email.trim())
    .maybeSingle()

  if (composerError) {
    console.error('[NOTIFICATIONS] Erro ao mapear usuário → compositor:', composerError.message)
    return null
  }

  if (composer?.id) return composer.id

  const { data: composerByLower } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id')
    .eq('email', user.email.trim().toLowerCase())
    .maybeSingle()

  return composerByLower?.id || null
}

async function getContentOwnerComposerIds(contentType: ContentType, contentId: string): Promise<string[]> {
  if (contentType === 'studio_music') {
    const { data, error } = await supabaseAdmin
      .from('studio_projects')
      .select('composer_id')
      .eq('id', contentId)
      .maybeSingle()

    if (error) {
      console.error('[NOTIFICATIONS] Erro ao buscar dono do Studio:', error.message)
      return []
    }
    return data?.composer_id ? [data.composer_id] : []
  }

  if (contentType === 'music') {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('composer_id')
      .eq('music_id', contentId)

    if (error) {
      console.error('[NOTIFICATIONS] Erro ao buscar compositores da música:', error.message)
      return []
    }
    return [...new Set((data || []).map((row: any) => row.composer_id).filter(Boolean))]
  }

  const { data, error } = await supabaseAdmin
    .from('dccmusic_video_composers')
    .select('composer_id')
    .eq('video_id', contentId)

  if (error) {
    console.error('[NOTIFICATIONS] Erro ao buscar compositores do vídeo:', error.message)
    return []
  }
  return [...new Set((data || []).map((row: any) => row.composer_id).filter(Boolean))]
}

export async function getContentLink(
  contentType: ContentType,
  contentId: string
): Promise<{ href: string; title: string }> {
  if (contentType === 'studio_music') {
    const { data } = await supabaseAdmin
      .from('studio_projects')
      .select('id, title, public_slug')
      .eq('id', contentId)
      .maybeSingle()

    const title = data?.title || ''
    if (data?.public_slug) {
      return { href: `/studio/${data.public_slug}`, title }
    }
    return { href: `/compositores/admin/studio-ia/projetos/${contentId}`, title }
  }

  if (contentType === 'music') {
    const { data } = await supabaseAdmin
      .from('dccmusic_musics')
      .select('title, slug')
      .eq('id', contentId)
      .maybeSingle()

    return {
      href: data?.slug ? `/musicas/${data.slug}` : '/musicas',
      title: data?.title || '',
    }
  }

  const { data } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('title, slug')
    .eq('id', contentId)
    .maybeSingle()

  return {
    href: data?.slug ? `/videos/${data.slug}` : '/videos',
    title: data?.title || '',
  }
}

function actorLabel(name: string | null | undefined, fallback: string) {
  const trimmed = String(name || '').trim()
  return trimmed || fallback
}

function contentFallback(t: any, contentType: ContentType) {
  if (contentType === 'video') return t('global.notifications.content.video')
  return t('global.notifications.content.song')
}

export async function notifyNewComment(input: {
  actorSiteUserId: string
  actorName?: string | null
  contentType: ContentType
  contentId: string
  commentId: string
  comment: string
}) {
  const [owners, actorComposerId, content] = await Promise.all([
    getContentOwnerComposerIds(input.contentType, input.contentId),
    getComposerIdBySiteUserId(input.actorSiteUserId),
    getContentLink(input.contentType, input.contentId),
  ])

  await Promise.all(
    owners
      .filter((composerId) => composerId !== actorComposerId)
      .map(async (composerId) => {
        const t = await getNotificationTranslator(composerId)
        const actor = actorLabel(input.actorName, t('global.notifications.actorFallback'))
        const title = content.title || contentFallback(t, input.contentType)
        return createNotification({
          composerId,
          type: 'comment',
          title: t('global.notifications.commentTitle', { actor, title }),
          body: input.comment.slice(0, 280),
          href: content.href,
          actorName: actor,
          eventKey: `comment/${input.commentId}/${composerId}`,
        })
      })
  )
}

export async function notifyCommentReply(input: {
  actorSiteUserId: string
  actorName?: string | null
  parentAuthorSiteUserId: string
  contentType: ContentType
  contentId: string
  commentId: string
  comment: string
}) {
  if (input.actorSiteUserId === input.parentAuthorSiteUserId) return

  const [recipientComposerId, content] = await Promise.all([
    getComposerIdBySiteUserId(input.parentAuthorSiteUserId),
    getContentLink(input.contentType, input.contentId),
  ])

  if (!recipientComposerId) return

  const t = await getNotificationTranslator(recipientComposerId)
  const actor = actorLabel(input.actorName, t('global.notifications.actorFallback'))
  await createNotification({
    composerId: recipientComposerId,
    type: 'reply',
    title: t('global.notifications.replyTitle', { actor }),
    body: input.comment.slice(0, 280),
    href: content.href,
    actorName: actor,
    eventKey: `reply/${input.commentId}`,
  })
}

export async function notifyCommentLike(input: {
  actorSiteUserId: string
  actorName?: string | null
  commentAuthorSiteUserId: string
  contentType: ContentType
  contentId: string
  commentId: string
}) {
  if (input.actorSiteUserId === input.commentAuthorSiteUserId) return

  const [recipientComposerId, content] = await Promise.all([
    getComposerIdBySiteUserId(input.commentAuthorSiteUserId),
    getContentLink(input.contentType, input.contentId),
  ])

  if (!recipientComposerId) return

  const t = await getNotificationTranslator(recipientComposerId)
  const actor = actorLabel(input.actorName, t('global.notifications.actorFallback'))
  const title = content.title || contentFallback(t, input.contentType)
  await createNotification({
    composerId: recipientComposerId,
    type: 'comment_like',
    title: t('global.notifications.likeTitle', { actor }),
    body: t('global.notifications.likeBody', { title }),
    href: content.href,
    actorName: actor,
    eventKey: `comment-like/${input.commentId}/${input.actorSiteUserId}`,
  })
}

export async function notifyMusicReady(input: {
  composerId: string
  projectId: string
  projectTitle: string
  generationId?: string | null
}) {
  const t = await getNotificationTranslator(input.composerId)
  await createNotification({
    composerId: input.composerId,
    type: 'new_music',
    title: t('global.notifications.musicReadyTitle', { title: input.projectTitle }),
    body: t('global.notifications.musicReadyBody'),
    href: `/compositores/admin/studio-ia/projetos/${input.projectId}`,
    eventKey: `studio-ready/${input.generationId || input.projectId}`,
  })
}
