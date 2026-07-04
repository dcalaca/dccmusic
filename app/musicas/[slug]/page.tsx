import * as db from '@/lib/db'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import MusicCard from '@/components/MusicCard'
import { FiExternalLink } from 'react-icons/fi'
import { formatDate } from '@/lib/utils'
import CopyButton from '@/components/CopyButton'
import SpotifyEmbed from '@/components/SpotifyEmbed'
import RatingAndComments from '@/components/RatingAndComments'

// Forçar renderização dinâmica para sempre buscar dados atualizados
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getMusic(slug: string) {
  try {
    // Usar versão sem cache para garantir dados atualizados
    return await db.getMusicBySlugFresh(slug)
  } catch (error) {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const music = await getMusic(params.slug)

  if (!music) {
    return {
      title: 'Música não encontrada',
    }
  }

  const description = music.description
    ? `Letra e onde ouvir "${music.title}" no DCC Music. ${music.description}`.slice(0, 300)
    : `Ouça a música ${music.title} no DCC Music`

  return {
    title: music.title,
    description,
    alternates: {
      canonical: `/musicas/${params.slug}`,
    },
    openGraph: {
      type: 'music.song',
      url: `https://www.dccmusic.online/musicas/${params.slug}`,
      title: music.title,
      description,
      images: music.coverUrl ? [music.coverUrl] : undefined,
    },
  }
}

function buildMusicJsonLd(music: NonNullable<Awaited<ReturnType<typeof getMusic>>>) {
  const pageUrl = `https://www.dccmusic.online/musicas/${music.slug}`

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: music.title,
    url: pageUrl,
    datePublished: new Date(music.publishedAt || music.createdAt || Date.now()).toISOString(),
  }

  if (music.genre) schema.genre = music.genre
  if (music.coverUrl) schema.image = music.coverUrl

  const audioUrl = music.spotifyUrl || music.appleMusicUrl
  if (audioUrl) schema.sameAs = audioUrl

  if (music.composers && music.composers.length > 0) {
    schema.byArtist = music.composers.map((composer) => ({
      '@type': 'MusicGroup',
      name: composer.name,
      url: `https://www.dccmusic.online/compositores/${composer.slug}`,
    }))
  }

  return schema
}

export default async function MusicDetailPage({ params }: { params: { slug: string } }) {
  const music = await getMusic(params.slug)

  if (!music) {
    notFound()
  }

  try {
    const h = headers()
    const forwarded = h.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    await db.recordMusicView(music.id, {
      ipAddress: ip,
      userAgent: h.get('user-agent'),
      referer: h.get('referer'),
      accept: h.get('accept'),
      acceptLanguage: h.get('accept-language'),
      acceptEncoding: h.get('accept-encoding'),
    })
  } catch (viewError) {
    console.error('Erro ao registrar visualização da música:', viewError)
  }

  const musicFresh = await db.getMusicBySlugFresh(params.slug)
  const displayMusic = musicFresh || music

  const relatedMusics = displayMusic.genre ? await db.getRelatedMusics(displayMusic.genre, displayMusic.id) : []
  const musicUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/musicas/${displayMusic.slug}`

  return (
    <MusicDetailContent music={displayMusic} relatedMusics={relatedMusics} musicUrl={musicUrl} />
  )
}

function getMusicPlatformLabel(url?: string | null) {
  if (!url) return 'plataforma'

  if (/soundcloud\.com/i.test(url)) return 'SoundCloud'
  if (/music\.apple\.com/i.test(url)) return 'Apple Music'
  if (/spotify\.com/i.test(url)) return 'Spotify'

  return 'plataforma'
}

function MusicDetailContent({ 
  music, 
  relatedMusics, 
  musicUrl 
}: { 
  music: NonNullable<Awaited<ReturnType<typeof getMusic>>>
  relatedMusics: any[]
  musicUrl: string
}) {
  const musicPlatformLabel = getMusicPlatformLabel(music.spotifyUrl)
  const hasAudioPublished = db.hasPlayableMusicSource(music)

  return (
    <div className="min-h-screen py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildMusicJsonLd(music)) }}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Player da plataforma musical no topo */}
          <div className="mb-8">
            {music.spotifyEmbed ? (
              <SpotifyEmbed embedCode={music.spotifyEmbed} />
            ) : music.spotifyUrl ? (
              <div className="bg-gray-900/50 p-8 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400 mb-4">Player não disponível</p>
                <a
                  href={music.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <FiExternalLink className="w-5 h-5" />
                  <span>Abrir no {musicPlatformLabel}</span>
                </a>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-800/40 bg-yellow-950/20 p-6 text-center">
                <p className="font-semibold text-yellow-200">Áudio ainda não publicado</p>
                <p className="mt-2 text-sm text-yellow-100/80">
                  Esta página tem a letra cadastrada, mas ainda não tem um player de música disponível.
                </p>
              </div>
            )}
          </div>

          {/* Título e informações */}
          <div className="mb-8">
            {music.genre && (
              <span className="inline-block px-3 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800 text-sm mb-3">
                {music.genre}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{music.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
              <span>Publicado em {formatDate(music.publishedAt)}</span>
              {music.viewCount > 0 && (
                <span>{music.viewCount.toLocaleString('pt-BR')} visualizações</span>
              )}
            </div>
            {music.tags && (
              <div className="mb-6 flex flex-wrap gap-2">
                {music.tags.split(',').map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
            {music.composers && music.composers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Compositores</h3>
                <div className="flex flex-wrap gap-2">
                  {music.composers.map((composer) => (
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
            <div className="flex flex-wrap gap-2 mb-8">
              <CopyButton text={musicUrl} label="Copiar link" />
              {music.spotifyUrl && (
                <a
                  href={music.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                  <span>Abrir no {musicPlatformLabel}</span>
                </a>
              )}
            </div>
          </div>

          {/* Letra (descrição) */}
          {music.description && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-4">
                <span className="gradient-text">Letra</span>
              </h2>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <p className="text-gray-300 whitespace-pre-line leading-relaxed">{music.description}</p>
              </div>
            </div>
          )}

          {/* Avaliações e Comentários */}
          {hasAudioPublished && (
            <div className="mb-12">
              <RatingAndComments contentType="music" contentId={music.id} />
            </div>
          )}

          {/* Músicas Relacionadas */}
          {relatedMusics.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                <span className="gradient-text">Músicas Semelhantes</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedMusics.map((relatedMusic) => (
                  <MusicCard key={relatedMusic.id} music={relatedMusic} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
