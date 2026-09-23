import * as db from '@/lib/db'
import VideoCard from '@/components/VideoCard'
import VideoFilters from '@/components/VideoFilters'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import { createDccI18n } from '@/i18n/i18next'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalidar a cada hora

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = 'https://www.dccmusic.online'
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)
  
  return {
    title: t('publicVideos.metadata.title'),
    description: t('publicVideos.metadata.description'),
    keywords: [
      t('publicVideos.metadata.keywords.musicVideos'),
      t('publicVideos.metadata.keywords.clips'),
      t('publicVideos.metadata.keywords.dccVideos'),
      t('publicVideos.metadata.keywords.music'),
      t('publicVideos.metadata.keywords.youtubeMusic'),
      t('publicVideos.metadata.keywords.releases'),
      t('publicVideos.metadata.keywords.videoMusic'),
    ],
    alternates: {
      canonical: `${baseUrl}/videos`,
    },
    openGraph: {
      title: t('publicVideos.metadata.title'),
      description: t('publicVideos.metadata.shortDescription'),
      url: `${baseUrl}/videos`,
      type: 'website',
      siteName: 'DCC Music',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('publicVideos.metadata.title'),
      description: t('publicVideos.metadata.shortDescription'),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

interface VideosPageProps {
  searchParams: {
    genero?: string | string[]
    ano?: string
    ordem?: string
    busca?: string
    pagina?: string
  }
}

export default async function VideosPage({ searchParams = {} }: VideosPageProps) {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)

  // Buscar TODOS os vídeos sem filtros no banco
  const allVideos = await db.getVideos({ ordem: 'recentes' })
  
  // Buscar gêneros e anos
  const [genres, anos] = await Promise.all([
    db.getGenresWithVideoCount(),
    db.getVideoYears(),
  ])

  // Processar filtros client-side (simulado aqui, mas será feito no componente)
  const genero = Array.isArray(searchParams.genero) 
    ? searchParams.genero 
    : searchParams.genero 
      ? [searchParams.genero] 
      : []
  const ano = searchParams.ano && searchParams.ano !== '' ? parseInt(searchParams.ano) : undefined
  const busca = searchParams.busca && searchParams.busca.trim() !== '' ? searchParams.busca.trim() : undefined
  const ordem =
    (searchParams.ordem as 'recentes' | 'antigos' | 'az' | 'mais-vistos') || 'mais-vistos'
  const pagina = parseInt(searchParams.pagina || '1')
  const porPagina = 12

  // Aplicar filtros client-side
  let filteredVideos = [...allVideos]

  // Filtro de gênero
  if (genero.length > 0) {
    filteredVideos = filteredVideos.filter(v => v.genre && genero.includes(v.genre))
  }

  // Filtro de ano
  if (ano) {
    filteredVideos = filteredVideos.filter(v => {
      if (!v.publishedAt) return false
      return new Date(v.publishedAt).getFullYear() === ano
    })
  }

  // Filtro de busca
  if (busca) {
    const buscaLower = busca.toLowerCase()
    filteredVideos = filteredVideos.filter(v => 
      v.title.toLowerCase().includes(buscaLower) ||
      (v.tags && v.tags.toLowerCase().includes(buscaLower)) ||
      (v.description && v.description.toLowerCase().includes(buscaLower))
    )
  }

  // Ordenação
  if (ordem === 'recentes') {
    filteredVideos.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      if (dateB !== dateA) return dateB - dateA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  } else if (ordem === 'antigos') {
    filteredVideos.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      if (dateA !== dateB) return dateA - dateB
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  } else if (ordem === 'az') {
    filteredVideos.sort((a, b) => a.title.localeCompare(b.title))
  } else if (ordem === 'mais-vistos') {
    filteredVideos.sort((a, b) => {
      const va = a.viewCount ?? 0
      const vb = b.viewCount ?? 0
      if (vb !== va) return vb - va
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return dateB - dateA
    })
  }

  // Paginação
  const total = filteredVideos.length
  const totalPages = Math.ceil(total / porPagina)
  const paginatedVideos = filteredVideos.slice(
    (pagina - 1) * porPagina,
    pagina * porPagina
  )

  // Construir URL de paginação preservando filtros
  const buildPaginationUrl = (newPage: number) => {
    const params = new URLSearchParams()
    
    if (genero.length > 0) {
      genero.forEach(g => params.append('genero', g))
    }
    if (ano) params.set('ano', String(ano))
    if (ordem !== 'mais-vistos') params.set('ordem', ordem)
    if (busca) params.set('busca', busca)
    params.set('pagina', String(newPage))
    
    return `?${params.toString()}`
  }

  // Schema.org para CollectionPage
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('publicVideos.metadata.title'),
    description: t('publicVideos.metadata.shortDescription'),
    url: 'https://www.dccmusic.online/videos',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: paginatedVideos.slice(0, 10).map((video, index) => ({
        '@type': 'VideoObject',
        position: index + 1,
        name: video.title,
        description: video.description || '',
        thumbnailUrl: video.thumbnailUrl || '',
        uploadDate: video.publishedAt || video.createdAt,
        contentUrl: video.youtubeUrl || '',
        embedUrl: video.youtubeEmbed || video.youtubeUrl || '',
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">{t('publicVideos.title')}</span>
            </h1>
            <p className="text-gray-400">
              {t('publicVideos.subtitle')}
            </p>
          </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar de Filtros */}
          <aside className="lg:w-64 flex-shrink-0">
            <Suspense fallback={<div className="text-gray-400">{t('publicVideos.loadingFilters')}</div>}>
              <VideoFilters genres={genres} anos={anos} currentParams={searchParams} />
            </Suspense>
          </aside>

          {/* Conteúdo Principal */}
          <main className="flex-1">
            {paginatedVideos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">{t('publicVideos.empty')}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-400">
                  {t('publicVideos.count', { count: total })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center space-x-2">
                    {pagina > 1 && (
                      <a
                        href={buildPaginationUrl(pagina - 1)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t('publicVideos.pagination.previous')}
                      </a>
                    )}
                    <span className="px-4 py-2 text-gray-400">
                      {t('publicVideos.pagination.pageOf', { page: pagina, total: totalPages })}
                    </span>
                    {pagina < totalPages && (
                      <a
                        href={buildPaginationUrl(pagina + 1)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t('publicVideos.pagination.next')}
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
    </>
  )
}
