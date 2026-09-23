import * as db from '@/lib/db'
import { notFound } from 'next/navigation'
import VideoCard from '@/components/VideoCard'
import { FiExternalLink } from 'react-icons/fi'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import VideoEmbed from '@/components/VideoEmbed'
import CopyButton from '@/components/CopyButton'
import RatingAndComments from '@/components/RatingAndComments'
import { headers } from 'next/headers'

/** Só busca vídeo — sem contar visualização (evita dupla contagem com generateMetadata) */
async function fetchVideoOnly(slug: string) {
  try {
    return await db.getVideoBySlug(slug)
  } catch (error) {
    console.error('Erro ao buscar vídeo:', error)
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const video = await fetchVideoOnly(params.slug)
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)

  if (!video) {
    return {
      title: t('videoDetail.metadata.notFound'),
    }
  }

  const description = video.description || t('videoDetail.metadata.description', { title: video.title })

  return {
    title: video.title,
    description,
    alternates: {
      canonical: `/videos/${params.slug}`,
    },
    openGraph: {
      type: 'video.other',
      url: `https://www.dccmusic.online/videos/${params.slug}`,
      title: video.title,
      description,
      images: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
    },
  }
}

function buildVideoJsonLd(video: NonNullable<Awaited<ReturnType<typeof fetchVideoOnly>>>, fallbackDescription: string) {
  const pageUrl = `https://www.dccmusic.online/videos/${video.slug}`
  const thumbnail = video.thumbnailUrl
    || (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : undefined)

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description || fallbackDescription,
    uploadDate: new Date(video.publishedAt || video.createdAt || Date.now()).toISOString(),
    url: pageUrl,
  }

  if (thumbnail) schema.thumbnailUrl = [thumbnail]
  if (video.youtubeId) schema.embedUrl = `https://www.youtube.com/embed/${video.youtubeId}`

  if (video.composers && video.composers.length > 0) {
    schema.creator = video.composers.map((composer) => ({
      '@type': 'Person',
      name: composer.name,
      url: `https://www.dccmusic.online/compositores/${composer.slug}`,
    }))
  }

  return schema
}

export default async function VideoDetailPage({ params }: { params: { slug: string } }) {
  const video = await fetchVideoOnly(params.slug)

  if (!video) {
    notFound()
  }

  const h = headers()
  const country = normalizeCountry(h.get('x-dcc-country') || h.get('x-vercel-ip-country') || h.get('cf-ipcountry'))
  const locale = getLocaleForCountry(country)

  // Uma única contagem por carregamento da página (log + view_count)
  try {
    const forwarded = h.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    await db.recordVideoView(video.id, {
      ipAddress: ip,
      userAgent: h.get('user-agent'),
      referer: h.get('referer'),
      accept: h.get('accept'),
      acceptLanguage: h.get('accept-language'),
      acceptEncoding: h.get('accept-encoding'),
    })
  } catch (viewError) {
    console.error('Erro ao registrar visualização:', viewError)
  }

  const videoFresh = await db.getVideoBySlug(params.slug)

  // Debug: verificar se compositores foram carregados
  const displayVideo = videoFresh || video

  if (process.env.NODE_ENV === 'development') {
    console.log('Video composers:', displayVideo.composers)
  }

  // Buscar vídeos relacionados com tratamento de erro
  let relatedVideos: any[] = []
  try {
    if (displayVideo.genre) {
      relatedVideos = await db.getRelatedVideos(displayVideo.genre, displayVideo.id)
    }
  } catch (error) {
    console.error('Erro ao buscar vídeos relacionados:', error)
    // Continuar sem vídeos relacionados se houver erro
  }

  const videoUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/videos/${displayVideo.slug}`

  return (
    <VideoDetailContent video={displayVideo} relatedVideos={relatedVideos} videoUrl={videoUrl} locale={locale} />
  )
}

async function VideoDetailContent({ 
  video, 
  relatedVideos, 
  videoUrl,
  locale,
}: { 
  video: NonNullable<Awaited<ReturnType<typeof fetchVideoOnly>>>
  relatedVideos: any[]
  videoUrl: string
  locale: string
}) {
  const i18n = await createDccI18n(locale)
  const t = i18n.t.bind(i18n)
  const publishedDate = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(video.publishedAt))
  const formattedViews = new Intl.NumberFormat(locale).format(video.viewCount || 0)

  return (
    <div className="min-h-screen py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildVideoJsonLd(video, t('videoDetail.metadata.description', { title: video.title }))) }}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Player - Ocupa toda a largura disponível */}
          <div className="mb-8 w-full">
            <VideoEmbed youtubeId={video.youtubeId} youtubeEmbed={video.youtubeEmbed} />
          </div>

          {/* Informações */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="mb-4">
                {video.genre && (
                  <span className="inline-block px-3 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800 text-sm mb-3">
                    {video.genre}
                  </span>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">{video.title}</h1>
                {video.description && (
                  <p className="text-gray-300 mb-4 whitespace-pre-line">{video.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <span>{t('videoDetail.publishedAt', { date: publishedDate })}</span>
                  {video.viewCount > 0 && (
                    <span>{t('videoDetail.views', { count: formattedViews })}</span>
                  )}
                  {video.duration && <span>{t('videoDetail.duration', { duration: video.duration })}</span>}
                </div>
                {video.tags && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {video.tags.split(',').map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {video.composers && video.composers.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('videoDetail.songwriters')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {video.composers.map((composer) => (
                        <a
                          key={composer.id}
                          href={`/compositores/${composer.slug}`}
                          className="px-3 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800 text-sm hover:bg-primary-800 hover:text-primary-200 transition-colors cursor-pointer"
                        >
                          {composer.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800 space-y-4">
                <h3 className="font-semibold text-lg mb-4">{t('videoDetail.share')}</h3>
                <CopyButton text={videoUrl} label={t('videoDetail.copyLink')} />
                <a
                  href={video.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                  <span>{t('videoDetail.openYoutube')}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Avaliações e Comentários */}
          <div className="mb-12">
            <RatingAndComments contentType="video" contentId={video.id} />
          </div>

          {/* Vídeos Relacionados */}
          {relatedVideos.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                <span className="gradient-text">{t('videoDetail.similarVideos')}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedVideos.map((relatedVideo) => (
                  <VideoCard key={relatedVideo.id} video={relatedVideo} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
