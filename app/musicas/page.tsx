import * as db from '@/lib/db'
import MusicFilters from '@/components/MusicFilters'
import MusicList from '@/components/MusicList'
import ViewToggle from '@/components/ViewToggle'
import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MusicasPageProps {
  searchParams: {
    genero?: string | string[]
    plataforma?: string
    ordem?: string
    busca?: string
    pagina?: string
    visualizacao?: string
  }
}

async function getStudioCoverUrl(cover: any) {
  if (!cover) return null

  if (cover.image_path) {
    const { data } = await supabaseAdmin.storage
      .from('studio-assets')
      .createSignedUrl(cover.image_path, 60 * 60)

    if (data?.signedUrl) return data.signedUrl
  }

  return cover.image_url || null
}

async function getPublishedStudioMusics() {
  const { data, error } = await supabaseAdmin
    .from('studio_projects')
    .select(`
      id,
      title,
      style,
      mood,
      description,
      public_slug,
      published_at,
      created_at,
      updated_at,
      cover:studio_covers(image_url, image_path, is_current)
    `)
    .eq('status', 'published')
    .not('public_slug', 'is', null)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[Músicas] Erro ao buscar músicas Studio IA:', error)
    return []
  }

  return Promise.all((data || []).map(async (project: any) => {
    const currentCover = Array.isArray(project.cover)
      ? project.cover.find((cover: any) => cover.is_current) || project.cover[0]
      : project.cover

    return {
      id: `studio-${project.id}`,
      title: project.title,
      slug: project.public_slug,
      href: `/studio/${project.public_slug}`,
      genre: project.style || null,
      spotifyUrl: null,
      spotifyEmbed: null,
      appleMusicUrl: null,
      appleMusicEmbed: null,
      tags: 'DCC Studio IA',
      description: project.description || [project.style, project.mood, 'DCC Studio IA'].filter(Boolean).join(' '),
      coverUrl: await getStudioCoverUrl(currentCover),
      featured: false,
      viewCount: 0,
      sourceLabel: 'Studio IA',
      publishedAt: project.published_at ? new Date(project.published_at) : new Date(project.created_at),
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at || project.created_at),
    }
  }))
}

export default async function MusicasPage({ searchParams = {} }: MusicasPageProps) {
  // Buscar TODAS as músicas sem filtros no banco, incluindo músicas publicadas do Studio IA
  const [catalogMusics, studioMusics] = await Promise.all([
    db.getMusics({ ordem: 'recentes' }),
    getPublishedStudioMusics(),
  ])
  const allMusics = [...catalogMusics, ...studioMusics]
  
  // Buscar gêneros
  const genres = await db.getGenresWithMusicCount()

  // Processar filtros
  const genero = Array.isArray(searchParams.genero) 
    ? searchParams.genero 
    : searchParams.genero 
      ? [searchParams.genero] 
      : []
  const plataforma = searchParams.plataforma && searchParams.plataforma !== '' ? (searchParams.plataforma as 'spotify' | 'apple') : undefined
  const busca = searchParams.busca && searchParams.busca.trim() !== '' ? searchParams.busca.trim() : undefined
  const ordem = (searchParams.ordem as 'recentes' | 'antigos' | 'az' | 'mais-vistos') || 'mais-vistos'
  const visualizacao = (searchParams.visualizacao as 'lista' | 'grid') || 'lista'
  const pagina = parseInt(searchParams.pagina || '1')
  const porPagina = 12

  // Aplicar filtros client-side
  // Nota: As imagens do Spotify são buscadas no cliente pelo MusicCard para melhor performance
  let filteredMusics = [...allMusics]

  // Filtro de gênero
  if (genero.length > 0) {
    filteredMusics = filteredMusics.filter(m => m.genre && genero.includes(m.genre))
  }

  // Filtro de plataforma
  if (plataforma === 'spotify') {
    filteredMusics = filteredMusics.filter(m => m.spotifyUrl)
  } else if (plataforma === 'apple') {
    filteredMusics = filteredMusics.filter(m => m.appleMusicUrl)
  }

  // Filtro de busca
  if (busca) {
    const buscaLower = busca.toLowerCase()
    filteredMusics = filteredMusics.filter(m => 
      m.title.toLowerCase().includes(buscaLower) ||
      (m.tags && m.tags.toLowerCase().includes(buscaLower)) ||
      (m.description && m.description.toLowerCase().includes(buscaLower))
    )
  }

  // Ordenação
  if (ordem === 'recentes') {
    filteredMusics.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      if (dateB !== dateA) return dateB - dateA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  } else if (ordem === 'antigos') {
    filteredMusics.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      if (dateA !== dateB) return dateA - dateB
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  } else if (ordem === 'az') {
    filteredMusics.sort((a, b) => a.title.localeCompare(b.title))
  } else if (ordem === 'mais-vistos') {
    filteredMusics.sort((a, b) => {
      const va = a.viewCount ?? 0
      const vb = b.viewCount ?? 0
      if (vb !== va) return vb - va
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return dateB - dateA
    })
  }

  // Paginação
  const total = filteredMusics.length
  const totalPages = Math.ceil(total / porPagina)
  const paginatedMusics = filteredMusics.slice(
    (pagina - 1) * porPagina,
    pagina * porPagina
  )

  // Construir URL de paginação preservando filtros
  const buildPaginationUrl = (newPage: number) => {
    const params = new URLSearchParams()
    
    if (genero.length > 0) {
      genero.forEach(g => params.append('genero', g))
    }
    if (plataforma) params.set('plataforma', plataforma)
    if (ordem !== 'mais-vistos') params.set('ordem', ordem)
    if (busca) params.set('busca', busca)
    if (visualizacao !== 'lista') params.set('visualizacao', visualizacao)
    params.set('pagina', String(newPage))
    
    return `?${params.toString()}`
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="gradient-text">Músicas</span>
          </h1>
          <p className="text-gray-400">
            Explore minha coleção completa de músicas
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar de Filtros */}
          <aside className="lg:w-64 flex-shrink-0">
            <Suspense fallback={<div className="text-gray-400">Carregando filtros...</div>}>
              <MusicFilters genres={genres} currentParams={searchParams} />
            </Suspense>
          </aside>

          {/* Conteúdo Principal */}
          <main className="flex-1">
            {paginatedMusics.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">Nenhuma música encontrada.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-400">
                    {total} música{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
                  </div>
                  <Suspense fallback={<div className="w-32 h-10 bg-gray-800 rounded-lg animate-pulse"></div>}>
                    <ViewToggle defaultView={visualizacao} />
                  </Suspense>
                </div>
                <Suspense fallback={<div className="text-gray-400">Carregando músicas...</div>}>
                  <MusicList musics={paginatedMusics} view={visualizacao} />
                </Suspense>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center space-x-2">
                    {pagina > 1 && (
                      <a
                        href={buildPaginationUrl(pagina - 1)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Anterior
                      </a>
                    )}
                    <span className="px-4 py-2 text-gray-400">
                      Página {pagina} de {totalPages}
                    </span>
                    {pagina < totalPages && (
                      <a
                        href={buildPaginationUrl(pagina + 1)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Próxima
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
  )
}
