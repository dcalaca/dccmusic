import * as db from '@/lib/db'
import { unstable_noStore as noStore } from 'next/cache'
import { FaCrown } from 'react-icons/fa'
import { FiMusic, FiSearch, FiStar, FiUsers } from 'react-icons/fi'
import ComposersDirectory from './ComposersDirectory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CompositorsPage() {
  noStore()

  const composers = await db.getPremiumComposers()
  const totalPublishedMusics = composers.reduce(
    (total, composer) => total + (Number(composer.publishedMusicCount) || 0),
    0
  )

  const directoryComposers = composers.map((composer) => ({
    id: composer.id,
    name: composer.name,
    slug: composer.slug,
    publishedMusicCount: composer.publishedMusicCount,
    profilePhotoUrl: composer.profilePhotoUrl,
  }))

  return (
    <div className="min-h-screen bg-black py-5 sm:py-7">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.32),transparent_36%),linear-gradient(135deg,rgba(8,8,12,0.98),rgba(17,24,39,0.96),rgba(49,15,80,0.72))] p-5 shadow-2xl shadow-purple-950/30 sm:p-7">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-40 sm:block"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(216,180,254,0.45) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                maskImage: 'linear-gradient(to left, black 20%, transparent 95%)',
                WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 95%)',
              }}
            />
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-purple-600/15 blur-3xl" />

            <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/15 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
                  <FiStar className="h-3.5 w-3.5" /> Compositores Premium
                </div>
                <h1 className="max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl lg:text-[2.6rem]">
                  Encontre compositores e conheça suas{' '}
                  <span className="text-purple-400">músicas publicadas</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                  Veja quem já publica no DCC Music, escute as obras e descubra novos nomes para acompanhar.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center sm:gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/35 px-2 py-4 backdrop-blur-sm sm:px-3">
                  <FiUsers className="mx-auto mb-2 h-5 w-5 text-purple-300" />
                  <p className="text-2xl font-black text-white">{composers.length}</p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-400">compositores</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 px-2 py-4 backdrop-blur-sm sm:px-3">
                  <FiMusic className="mx-auto mb-2 h-5 w-5 text-purple-300" />
                  <p className="text-2xl font-black text-white">{totalPublishedMusics}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-gray-400">
                    músicas publicadas
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-400/45 bg-gradient-to-b from-amber-950/35 to-black/40 px-2 py-4 shadow-[0_0_24px_rgba(251,191,36,0.12)] backdrop-blur-sm sm:px-3">
                  <FaCrown className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="text-xl font-black text-amber-100 sm:text-2xl">Premium</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-100/70">seleção especial</p>
                </div>
              </div>
            </div>
          </section>

          {composers.length === 0 ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-8 text-center shadow-2xl shadow-black/20">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-purple-200">
                <FiSearch className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black text-white">Nenhum compositor premium encontrado</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                Assim que novos compositores premium publicarem suas obras, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <ComposersDirectory composers={directoryComposers} />
          )}
        </div>
      </div>
    </div>
  )
}
