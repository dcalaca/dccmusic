import * as db from '@/lib/db'
import VideoCard from '@/components/VideoCard'
import MusicCard from '@/components/MusicCard'
import Link from 'next/link'
import { headers } from 'next/headers'
import { FiArrowRight, FiMusic, FiPlayCircle, FiZap } from 'react-icons/fi'
import { normalizeCountry } from '@/lib/localization'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export const metadata = {
  title: 'Explorar músicas e vídeos | DCC Music',
  description: 'Explore músicas e vídeos publicados pela comunidade DCC Music.',
  alternates: { canonical: '/explorar' },
}

export default async function ExplorarPage() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const isEnglish = country === 'US' || country === 'GB'
  const [videos, musics] = await Promise.all([
    db.getVideos({ featured: true, limit: 12, ordem: 'recentes' }),
    db.getMusics({ featured: true, limit: 12, ordem: 'recentes' }),
  ])

  return (
    <div className="min-h-screen bg-black">
      <section className="border-b border-gray-800 bg-gradient-to-b from-purple-950/50 via-black to-black px-4 py-12 sm:py-16">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-300">{isEnglish ? 'DCC Music community' : 'Comunidade DCC Music'}</p>
          <h1 className="text-3xl font-black text-white sm:text-5xl">{isEnglish ? 'Explore music created by people like you' : 'Explore músicas criadas por pessoas como você'}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-300">{isEnglish ? 'Listen to songs, watch videos and discover new composers.' : 'Ouça músicas, assista a vídeos e descubra novos compositores.'}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/studio-ia" className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-500">
              <FiZap className="mr-2 h-4 w-4" />
              {isEnglish ? 'Create your song' : 'Criar minha música'}
              <FiArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/videos" className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-purple-400">
              <FiPlayCircle className="mr-2 h-4 w-4" />
              {isEnglish ? 'All videos' : 'Todos os vídeos'}
            </Link>
            <Link href="/musicas" className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-purple-400">
              <FiMusic className="mr-2 h-4 w-4" />
              {isEnglish ? 'All songs' : 'Todas as músicas'}
            </Link>
          </div>
        </div>
      </section>

      <main className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {videos.length > 0 && (
          <section className="mb-12">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white sm:text-3xl">{isEnglish ? 'Featured videos' : 'Vídeos em destaque'}</h2>
              <Link href="/videos" className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-purple-200">{isEnglish ? 'See all' : 'Ver todos'} <FiArrowRight /></Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => <VideoCard key={video.id} video={video} />)}
            </div>
          </section>
        )}

        {musics.length > 0 && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white sm:text-3xl">{isEnglish ? 'Featured songs' : 'Músicas em destaque'}</h2>
              <Link href="/musicas" className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-purple-200">{isEnglish ? 'See all' : 'Ver todas'} <FiArrowRight /></Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {musics.map((music) => <MusicCard key={music.id} music={music} />)}
            </div>
          </section>
        )}

        {videos.length === 0 && musics.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-10 text-center text-gray-400">
            {isEnglish ? 'No public creations found yet.' : 'Ainda não há criações públicas para mostrar.'}
          </div>
        )}
      </main>
    </div>
  )
}
