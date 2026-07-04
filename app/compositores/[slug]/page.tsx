import * as db from '@/lib/db'
import { notFound } from 'next/navigation'
import VideoCard from '@/components/VideoCard'
import MusicCard from '@/components/MusicCard'
import ComposerFiltersWrapper from '@/components/ComposerFiltersWrapper'
import { supabaseAdmin } from '@/lib/supabase'
import { getComposerProfilePhotoUrl } from '@/lib/composer-profile-photo'

export const dynamic = 'force-dynamic'

interface ComposerPageProps {
  params: { slug: string }
  searchParams: {
    tipo?: 'todos' | 'videos' | 'musicas'
    genero?: string | string[]
    ordem?: 'mais-vistos' | 'recentes' | 'az'
    busca?: string
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const composer = await db.getComposerBySlug(params.slug)

  if (!composer) {
    return {
      title: 'Compositor não encontrado',
    }
  }

  const description = `Explore todas as músicas e vídeos do compositor ${composer.name} no DCC Music`

  return {
    title: composer.name,
    description,
    alternates: {
      canonical: `/compositores/${params.slug}`,
    },
    openGraph: {
      type: 'profile',
      url: `https://www.dccmusic.online/compositores/${params.slug}`,
      title: composer.name,
      description,
      images: composer.profilePhotoUrl ? [composer.profilePhotoUrl] : undefined,
    },
  }
}

export const revalidate = 0

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

export default async function ComposerDetailPage({ params, searchParams = {} }: ComposerPageProps) {
  const composer = await db.getComposerBySlug(params.slug)

  if (!composer) {
    notFound()
  }

  console.log('[COMPOSER-PAGE] Compositor encontrado:', {
    id: composer.id,
    name: composer.name,
    slug: params.slug
  })

  // Processar filtros
  const tipo = searchParams.tipo || 'todos'
  const genero = Array.isArray(searchParams.genero) 
    ? searchParams.genero 
    : searchParams.genero 
      ? [searchParams.genero] 
      : []
  const ordem = (searchParams.ordem as 'mais-vistos' | 'recentes' | 'az') || 'mais-vistos'
  const busca = searchParams.busca || undefined

  const filters = {
    genre: genero.length > 0 ? genero : undefined,
    busca,
    ordem,
  }

  // Buscar gêneros para os filtros
  const allGenres = await db.getGenres()

  // Buscar plano ativo do compositor para verificar vantagens
  const activePlan = await db.getComposerActivePlan(composer.id)
  const profilePhotoUrl = await getComposerProfilePhotoUrl(composer.id)
  const hasGoldBadge = activePlan?.hasGoldBadge || false
  const hasPremiumLayout = activePlan?.hasPremiumLayout || false

  // Buscar vídeos e músicas do compositor com filtros
  const [allVideos, allMusics, studioProjectsData] = await Promise.all([
    tipo === 'todos' || tipo === 'videos' ? db.getVideosByComposer(composer.id, filters) : Promise.resolve([]),
    tipo === 'todos' || tipo === 'musicas' ? db.getMusicsByComposer(composer.id, filters) : Promise.resolve([]),
    tipo === 'todos' || tipo === 'musicas'
      ? supabaseAdmin
          .from('studio_projects')
          .select(`
            id,
            title,
            style,
            mood,
            public_slug,
            published_at,
            cover:studio_covers(image_url, image_path, is_current)
          `)
          .eq('composer_id', composer.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const videos = tipo === 'todos' || tipo === 'videos' ? allVideos : []
  const musics = tipo === 'todos' || tipo === 'musicas' ? allMusics : []
  const studioProjects = await Promise.all((studioProjectsData.data || []).map(async (project: any) => {
    const currentCover = Array.isArray(project.cover) ? project.cover.find((cover: any) => cover.is_current) : project.cover

    return {
      ...project,
      cover: currentCover,
      coverUrl: await getStudioCoverUrl(currentCover),
    }
  }))

  console.log('[COMPOSER-PAGE] Obras encontradas:', {
    videos: videos.length,
    musics: musics.length,
    total: videos.length + musics.length,
    filtros: { tipo, genero, ordem, busca },
    videoIds: videos.map(v => v.id),
    videoTitles: videos.map(v => v.title),
    musicIds: musics.map(m => m.id),
    musicTitles: musics.map(m => m.title)
  })
  
  // Verificar se "Brinquei de Pecado" está na lista de vídeos
  const brinqueiId = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
  const brinqueiVideo = videos.find(v => v.id === brinqueiId)
  if (brinqueiVideo) {
    console.log('[COMPOSER-PAGE] ✅ Vídeo "Brinquei de Pecado" encontrado na lista de vídeos')
  } else {
    console.log('[COMPOSER-PAGE] ❌ Vídeo "Brinquei de Pecado" NÃO encontrado na lista de vídeos')
  }
  
  // Verificar se "Brinquei de Pecado" está na lista de músicas
  const brinqueiMusicId = 'd73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5'
  const brinqueiMusic = musics.find(m => m.id === brinqueiMusicId || (m.title && m.title.toLowerCase().includes('brinquei') && m.title.toLowerCase().includes('pecado')))
  if (brinqueiMusic) {
    console.log('[COMPOSER-PAGE] ✅ Música "Brinquei de Pecado" encontrada na lista de músicas:', {
      id: brinqueiMusic.id,
      title: brinqueiMusic.title,
      genre: brinqueiMusic.genre
    })
  } else {
    console.log('[COMPOSER-PAGE] ❌ Música "Brinquei de Pecado" NÃO encontrada na lista de músicas')
    console.log('[COMPOSER-PAGE] IDs e títulos das músicas encontradas:', musics.map(m => ({ id: m.id, title: m.title })))
  }

  const totalItems = videos.length + musics.length + studioProjects.length

  return (
    <div className={`min-h-screen py-8 ${hasPremiumLayout ? 'bg-gradient-to-b from-gray-900 via-black to-gray-900' : ''}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto ${hasPremiumLayout ? 'max-w-7xl' : 'max-w-6xl'}`}>
          {/* Header do Compositor */}
          <div className={`mb-8 ${hasPremiumLayout ? 'bg-gradient-to-r from-yellow-900/20 via-yellow-800/10 to-yellow-900/20 p-8 rounded-2xl border border-yellow-800/30' : ''}`}>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-primary-600 to-purple-600 text-3xl font-black text-white shadow-xl shadow-purple-950/30">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt={`Foto de ${composer.name}`} className="h-full w-full object-cover" />
                ) : (
                  composer.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className={`font-bold ${hasPremiumLayout ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'}`}>
                    <span className="gradient-text">{composer.name}</span>
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasGoldBadge && (
                      <span className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-black text-sm font-bold shadow-lg shadow-yellow-500/50 flex items-center gap-1">
                        <span>⭐</span>
                        <span>Artista Ouro</span>
                      </span>
                    )}
                    {composer.isPremium && (
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-primary-600 to-purple-600 text-white text-xs font-semibold">
                        PREMIUM
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-gray-400 ${hasPremiumLayout ? 'text-xl' : 'text-lg'}`}>
              Compositor • {totalItems} {totalItems === 1 ? 'obra' : 'obras'} no DCC Music
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
              <span>{videos.length} {videos.length === 1 ? 'vídeo' : 'vídeos'}</span>
              <span>{musics.length + studioProjects.length} {musics.length + studioProjects.length === 1 ? 'música' : 'músicas'}</span>
            </div>
            {hasPremiumLayout && (
              <div className="mt-6">
                {musics.length > 0 ? (
                  <a
                    href="#musicas-section"
                    className="inline-block px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-500/50"
                  >
                    🎵 Ouça Agora
                  </a>
                ) : videos.length > 0 ? (
                  <a
                    href="#videos-section"
                    className="inline-block px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-500/50"
                  >
                    ▶️ Assista Agora
                  </a>
                ) : null}
              </div>
            )}
          </div>

          {/* Filtros */}
          <ComposerFiltersWrapper genres={allGenres} />

          {/* Vídeos */}
          {videos.length > 0 && (
            <div id="videos-section" className="mb-12 scroll-mt-20">
              <h2 className="text-2xl font-bold mb-6">
                <span className="gradient-text">Vídeos</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </div>
          )}

          {/* Músicas */}
          {musics.length > 0 && (
            <div id="musicas-section" className="mb-12 scroll-mt-20">
              <h2 className="text-2xl font-bold mb-6">
                <span className="gradient-text">Músicas</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {musics.map((music) => (
                  <MusicCard key={music.id} music={music} view="grid" />
                ))}
              </div>
            </div>
          )}

          {studioProjects.length > 0 && (
            <div className="mb-12 scroll-mt-20">
              <h2 className="text-2xl font-bold mb-6">
                <span className="gradient-text">Criadas no DCC Studio IA</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {studioProjects.map((project: any) => (
                  <a
                    key={project.id}
                    href={`/studio/${project.public_slug}`}
                    className="group overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 hover:border-primary-500 transition-all"
                  >
                    <div className="flex h-36 items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950 to-black">
                      {project.coverUrl ? (
                        <img src={project.coverUrl} alt={project.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="px-4 text-center">
                          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-600/20 text-lg font-black text-purple-100">
                            DC
                          </div>
                          <p className="line-clamp-2 text-xs font-bold text-purple-100">{project.title}</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <span className="mb-2 inline-flex rounded-full bg-primary-900/60 px-2 py-1 text-[10px] text-primary-200">
                        Criado com DCC Studio IA
                      </span>
                      <h3 className="font-bold group-hover:text-primary-300">{project.title}</h3>
                      <p className="text-sm text-gray-400">{project.style || 'Livre'} · {project.mood || 'Sem clima'}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem se não houver conteúdo */}
          {totalItems === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">
                Nenhuma obra encontrada para este compositor.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
