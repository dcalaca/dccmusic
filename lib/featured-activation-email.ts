import { supabaseAdmin } from '@/lib/supabase'
import { getComposerEmailIdentity, sendDccEmail } from '@/lib/dcc-emails'
import { createDccI18n } from '@/i18n/i18next'
import { dccEmailButton, escapeEmailHtml } from '@/lib/dcc-email-template'
import { getEligibleStudioFeaturedMusic } from '@/lib/featured-studio'
import { getComposerEmailLanguage } from '@/lib/composer-email-language'

export async function sendFeaturedActivationEmail(featured: {
  id: string; composer_id: string; content_id: string; content_type: string; expires_at: string
}) {
  const composer = await getComposerEmailIdentity(featured.composer_id)
  if (!composer) return { sent: false, reason: 'composer_missing' }
  const language = getComposerEmailLanguage(composer.country)
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const i18n = await createDccI18n(locale)
  const t = i18n.t.bind(i18n)
  let content: { title: string; slug?: string | null } | null = null
  if (featured.content_type === 'studio_music') {
    const studio = await getEligibleStudioFeaturedMusic(featured.content_id)
    content = studio ? { title: studio.title, slug: studio.public_slug } : null
  } else {
    const table = featured.content_type === 'video' ? 'dccmusic_videos' : 'dccmusic_musics'
    const result = await supabaseAdmin.from(table).select('title, slug').eq('id', featured.content_id).maybeSingle()
    if (result.error) throw result.error
    content = result.data
  }
  const title = content?.title || t('featured.activation.fallbackTitle')
  const expiresAt = new Date(featured.expires_at)
  const date = expiresAt.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
  const base = (process.env.NEXTAUTH_URL || 'https://www.dccmusic.online').replace(/\/$/, '')
  const targetUrl = featured.content_type === 'studio_music' && content?.slug
    ? `${base}/studio/${encodeURIComponent(content.slug)}`
    : featured.content_type === 'music' && content?.slug
      ? `${base}/musicas/${encodeURIComponent(content.slug)}` : base
  return sendDccEmail({
    to: composer.email,
    subject: t('featured.activation.subject', { title }),
    title: t('featured.activation.heading'),
    preview: t('featured.activation.preview'),
    category: 'featured_activated',
    locale,
    eventKey: `featured-activated/${featured.id}`,
    metadata: { featuredId: featured.id, composerId: featured.composer_id, contentId: featured.content_id },
    contentHtml: `
      <p>${escapeEmailHtml(t('featured.activation.greeting', { name: composer.name }))}</p>
      <p>${escapeEmailHtml(t('featured.activation.message', { title }))}</p>
      <p><strong>${escapeEmailHtml(t('featured.activation.duration'))}</strong></p>
      <p>${escapeEmailHtml(t('featured.activation.expiry', { date }))}</p>
      ${dccEmailButton(t('featured.activation.button'), targetUrl)}
      <p>${escapeEmailHtml(t('featured.activation.closing'))}</p>
    `,
  })
}
