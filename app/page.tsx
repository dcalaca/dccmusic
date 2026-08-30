import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import VideoCard from '@/components/VideoCard'
import MusicCard from '@/components/MusicCard'
import GenreCard from '@/components/GenreCard'
import SiteStatsCompact from '@/components/SiteStatsCompact'
import ComposerSignupCta from '@/components/ComposerSignupCta'
import HeroImageCarousel from '@/components/HeroImageCarousel'
import Link from 'next/link'
import { FiPlayCircle, FiMusic, FiArrowRight, FiZap } from 'react-icons/fi'

export const metadata = {
  title: 'DCC Music - Músicas, Studio IA e Cifras',
  description:
    'Ouça lançamentos, crie músicas com Studio IA e gere cifras. Plataforma completa para compositores e ouvintes.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DCC Music - Músicas, Studio IA e Cifras',
    description:
      'Catálogo musical, criação com IA e cifras em um só lugar.',
    url: 'https://www.dccmusic.online',
    type: 'website',
  },
}

export const dynamic = 'force-dynamic' // Tornar dinâmico para evitar erro durante build se tabelas não existirem
export const revalidate = 60 // Revalidar a cada 60 segundos

/** Fundos do hero — arquivos em /public */
const HERO_STUDIO_IMAGES = [
  '/ChatGPT Image 6 de jun. de 2026, 23_44_11.png',
  '/ChatGPT Image 6 de jun. de 2026, 23_43_10.png',
  '/Estúdio de gravação com luzes neon-2560x1440.png',
  '/ChatGPT Image 6 de jun. de 2026, 23_28_07-2560x1440.png',
].map((image) => encodeURI(image))

const HERO_STUDIO_IMAGES_MOBILE = [
  '/Mobile 1.png',
  '/Mobile 2.png',
  '/Mobile 3.png',
  '/Mobile 4.png',
].map((image) => encodeURI(image))

type PublicAiMusicDay = {
  date: string
  label: string
  deliveredMusics: number
}

const TIME_ZONE = 'America/Sao_Paulo'

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00-03:00`)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

async function countPublicRowsByPaging(table: string) {
  const pageSize = 1000
  let total = 0

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id')
      .range(from, from + pageSize - 1)

    if (error) throw error

    const pageCount = data?.length || 0
    total += pageCount
    if (pageCount < pageSize) break
  }

  return total
}

async function countPublicRows(table: string) {
  try {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    // O PostgREST/Supabase corta selects em 1000 linhas. Para não limitar
    // compositores/usuários na home, confirma por paginação quando o count
    // vem nulo, 1000 ou acima desse teto clássico.
    if (typeof count === 'number' && count > 0 && count < 1000) {
      return count
    }

    const pagedCount = await countPublicRowsByPaging(table)
    if (typeof count === 'number' && count > pagedCount) return count
    return pagedCount
  } catch (error) {
    console.error(`Erro ao contar ${table}:`, error)
    try {
      return await countPublicRowsByPaging(table)
    } catch (pageError) {
      console.error(`Erro ao contar ${table} por paginação:`, pageError)
      return 0
    }
  }
}

async function getPublicAiMusicDays() {
  const todayKey = formatDayKey(new Date())
  const startDate = addDays(new Date(`${todayKey}T00:00:00-03:00`), -13)
  const endExclusive = addDays(new Date(`${todayKey}T00:00:00-03:00`), 1)
  const buckets = new Map<string, PublicAiMusicDay>()

  for (let current = new Date(startDate); current < endExclusive; current = addDays(current, 1)) {
    const date = formatDayKey(current)
    buckets.set(date, {
      date,
      label: formatDayLabel(date),
      deliveredMusics: 0,
    })
  }

  try {
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('studio_generations')
        .select('id, created_at, status')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endExclusive.toISOString())
        .range(from, from + pageSize - 1)

      if (error) throw error

      const rows = data || []
      for (const row of rows) {
        if (row.status === 'failed') continue
        const createdAt = row.created_at ? new Date(row.created_at) : null
        if (!createdAt || Number.isNaN(createdAt.getTime())) continue
        const bucket = buckets.get(formatDayKey(createdAt))
        if (bucket) bucket.deliveredMusics += 2
      }

      if (rows.length < pageSize) break
    }
  } catch (error) {
    console.error('Erro ao buscar solicitações de músicas IA:', error)
  }

  return Array.from(buckets.values())
}

async function getFeaturedContent() {
  try {
    const [featuredVideosResult, featuredMusicsResult, topGenresResult] = await Promise.allSettled([
      db.getVideos({ featured: true, limit: 6, ordem: 'recentes' }),
      db.getMusics({ featured: true, limit: 6, ordem: 'recentes' }),
      db.getTopGenres(6),
    ])

    const featuredVideos = featuredVideosResult.status === 'fulfilled' 
      ? (featuredVideosResult.value || [])
      : []
    
    const featuredMusics = featuredMusicsResult.status === 'fulfilled'
      ? (featuredMusicsResult.value || [])
      : []
    
    const topGenres = topGenresResult.status === 'fulfilled'
      ? (topGenresResult.value || [])
      : []

    return {
      featuredVideos: Array.isArray(featuredVideos) ? featuredVideos : [],
      featuredMusics: Array.isArray(featuredMusics) ? featuredMusics : [],
      topGenres: Array.isArray(topGenres) ? topGenres : [],
    }
  } catch (error) {
    // Se as tabelas não existirem ainda, retornar arrays vazios
    console.error('Erro ao buscar conteúdo:', error)
    return {
      featuredVideos: [],
      featuredMusics: [],
      topGenres: [],
    }
  }
}

async function getSiteSummaryStats() {
  const [
    rVideos,
    rMusics,
    rVideoViews,
    rMusicViews,
    rComposers,
    rComments,
    rRatings,
    rAiMusics,
    rAiDays,
  ] = await Promise.allSettled([
    db.countAllVideos(),
    db.countAllMusics(),
    db.getTotalViews(),
    db.getTotalMusicViews(),
    countPublicRows('dccmusic_composers'),
    countPublicRows('dccmusic_comments'),
    countPublicRows('dccmusic_ratings'),
    countPublicRows('studio_versions'),
    getPublicAiMusicDays(),
  ])

  return {
    totalVideos: rVideos.status === 'fulfilled' ? rVideos.value : 0,
    totalMusics: rMusics.status === 'fulfilled' ? rMusics.value : 0,
    videoViews: rVideoViews.status === 'fulfilled' ? rVideoViews.value : 0,
    musicViews: rMusicViews.status === 'fulfilled' ? rMusicViews.value : 0,
    totalComposers: rComposers.status === 'fulfilled' ? rComposers.value : 0,
    totalComments: rComments.status === 'fulfilled' ? rComments.value : 0,
    totalRatings: rRatings.status === 'fulfilled' ? rRatings.value : 0,
    deliveredAiMusics: rAiMusics.status === 'fulfilled' ? rAiMusics.value : 0,
    aiMusicDays: rAiDays.status === 'fulfilled' ? rAiDays.value : [],
  }
}

export default async function Home() {
  const [{ featuredVideos, featuredMusics, topGenres }, siteStats] = await Promise.all([
    getFeaturedContent(),
    getSiteSummaryStats(),
  ])

  return (
    <div className="min-h-screen">
      <section className="relative flex flex-col bg-black" aria-label="Destaque principal">
        {/* Hero: foto em tela cheia + copy centralizada por cima (sem colunas) */}
        <div className="relative min-h-[min(68vh,680px)] w-full bg-black">
          <HeroImageCarousel
            images={HERO_STUDIO_IMAGES}
            mobileImages={HERO_STUDIO_IMAGES_MOBILE}
            intervalMs={3000}
          />
          <div className="relative z-10 flex min-h-[min(68vh,680px)] flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-4 pt-7 pb-12 sm:px-6 sm:pt-9 sm:pb-14">
              <div className="w-full max-w-2xl text-center">
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-balance sm:text-3xl md:text-4xl [text-shadow:0_2px_8px_rgba(0,0,0,0.95),0_4px_24px_rgba(0,0,0,0.85)]">
                  <span className="text-white">Músicas prontas </span>
                  <span className="font-bold text-fuchsia-400 sm:text-fuchsia-300 [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.85)]">
                    para você gravar
                  </span>
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-100 sm:mt-4 sm:text-base [text-shadow:0_1px_6px_rgba(0,0,0,0.95),0_2px_16px_rgba(0,0,0,0.8)]">
                  Catálogo em um só lugar: ouça, escolha e leve para o estúdio. Plataforma pensada para artistas e
                  compositores que querem resultado com agilidade.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-7 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/studio-ia"
                    className="group inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 sm:w-auto"
                  >
                    <FiZap className="mr-2 h-5 w-5 shrink-0" />
                    Studio IA
                    <FiArrowRight className="ml-2 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/videos"
                    className="group inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 sm:w-auto neon-glow"
                  >
                    <FiPlayCircle className="mr-2 h-5 w-5 shrink-0" />
                    Ver Vídeos
                    <FiArrowRight className="ml-2 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/musicas"
                    className="group inline-flex w-full max-w-xs items-center justify-center rounded-lg border-2 border-white bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-950 sm:w-auto"
                  >
                    <FiMusic className="mr-2 h-5 w-5 shrink-0" />
                    Ouvir Músicas
                    <FiArrowRight className="ml-2 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Gêneros */}
      {topGenres.length > 0 && (
        <section className="py-9 sm:py-10 bg-black">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-5 text-center">
              <span className="gradient-text">Top Gêneros</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-stretch">
              {topGenres.map((genre) => (
                <GenreCard 
                  key={genre.id} 
                  genre={genre} 
                  count={genre.count} 
                  videosCount={genre.videosCount}
                  musicsCount={genre.musicsCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Destaques - Vídeos */}
      {featuredVideos.length > 0 && (
        <section className="py-9 sm:py-10 bg-gray-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold">
                <span className="gradient-text">Vídeos em Destaque</span>
              </h2>
              <Link
                href="/videos"
                className="text-primary-400 hover:text-primary-300 flex items-center space-x-2 transition-colors"
              >
                <span>Ver todos</span>
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {featuredVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Destaques - Músicas */}
      {featuredMusics.length > 0 && (
        <section className="py-9 sm:py-10 bg-black">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold">
                <span className="gradient-text">Músicas em Destaque</span>
              </h2>
              <Link
                href="/musicas"
                className="text-primary-400 hover:text-primary-300 flex items-center space-x-2 transition-colors"
              >
                <span>Ver todas</span>
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {featuredMusics.map((music) => (
                <MusicCard key={music.id} music={music} />
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteStatsCompact
        totalVideos={siteStats.totalVideos}
        videoViews={siteStats.videoViews}
        totalMusics={siteStats.totalMusics}
        musicViews={siteStats.musicViews}
        totalComposers={siteStats.totalComposers}
        totalComments={siteStats.totalComments}
        totalRatings={siteStats.totalRatings}
        deliveredAiMusics={siteStats.deliveredAiMusics}
        aiMusicDays={siteStats.aiMusicDays}
      />

      {/* CTA compositor — no final, para não competir com o Studio IA no topo */}
      <section className="border-t border-purple-900 bg-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2.5 text-left sm:gap-3">
              <span className="text-xl leading-none sm:text-2xl" aria-hidden>
                🎤
              </span>
              <div>
                <p className="text-sm font-bold leading-tight text-white sm:text-base">
                  É compositor? Publique suas músicas
                </p>
                <p className="mt-0.5 text-xs text-gray-400">Receba avaliações e alcance novos ouvintes</p>
              </div>
            </div>
            <ComposerSignupCta
              guestLabel="Cadastrar grátis"
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-white px-5 py-2 text-sm font-bold text-violet-950 transition hover:bg-gray-100 sm:w-auto"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
