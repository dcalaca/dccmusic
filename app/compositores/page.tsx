import * as db from '@/lib/db'
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { FiArrowRight, FiAward, FiMusic, FiSearch, FiStar, FiUsers } from 'react-icons/fi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatMusicCount(count?: number) {
  const total = Number(count) || 0
  return total === 1 ? '1 música publicada' : `${total} músicas publicadas`
}

function getInitials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default async function CompositorsPage() {
  noStore()

  const composers = await db.getPremiumComposers()
  const totalPublishedMusics = composers.reduce((total, composer) => total + (Number(composer.publishedMusicCount) || 0), 0)

  return (
    <div className="min-h-screen bg-black py-5 sm:py-7">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,rgba(8,8,12,0.98),rgba(17,24,39,0.94),rgba(49,15,80,0.68))] p-4 shadow-2xl shadow-purple-950/25 sm:p-6">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute bottom-0 right-10 hidden h-px w-1/2 bg-gradient-to-r from-transparent via-purple-300/50 to-transparent sm:block" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_0.78fr] lg:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
                  <FiAward /> Compositores Premium
                </div>
                <h1 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">
                  Encontre compositores e conheça suas músicas publicadas
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                  Veja quem já publica no DCC Music, escute as obras e descubra novos nomes para acompanhar.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <FiUsers className="mx-auto mb-1 h-5 w-5 text-purple-200" />
                  <p className="text-xl font-black text-white">{composers.length}</p>
                  <p className="text-[11px] font-semibold text-gray-400">compositores</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <FiMusic className="mx-auto mb-1 h-5 w-5 text-primary-200" />
                  <p className="text-xl font-black text-white">{totalPublishedMusics}</p>
                  <p className="text-[11px] font-semibold text-gray-400">músicas</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <FiStar className="mx-auto mb-1 h-5 w-5 text-yellow-200" />
                  <p className="text-xl font-black text-white">Premium</p>
                  <p className="text-[11px] font-semibold text-gray-400">seleção</p>
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
            <>
              <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/75 p-3 shadow-2xl shadow-black/20 sm:p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white sm:text-2xl">Todos os compositores</h2>
                    <p className="mt-1 text-sm text-gray-400">Ordenados por quantidade de músicas publicadas.</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-gray-300">
                    {composers.length} no total
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {composers.map((composer, index) => (
                    <Link
                      key={composer.id}
                      href={`/compositores/${composer.slug}`}
                      className={`group rounded-2xl border p-3 transition hover:border-primary-400/50 hover:bg-white/[0.04] ${index < 3 ? 'border-yellow-400/30 bg-gradient-to-br from-yellow-950/20 via-purple-950/20 to-black shadow-lg shadow-yellow-950/10' : 'border-white/10 bg-black/25'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 text-sm font-black text-white">
                          {composer.profilePhotoUrl ? (
                            <img src={composer.profilePhotoUrl} alt={`Foto de ${composer.name}`} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(composer.name)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-black text-white transition group-hover:text-primary-200">
                              {composer.name}
                            </h3>
                            {index < 3 && <FiStar className="h-3.5 w-3.5 shrink-0 text-yellow-300" />}
                          </div>
                          {index < 3 && (
                            <span className="mt-1 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-black text-yellow-100">
                              Destaque #{index + 1}
                            </span>
                          )}
                          <p className="mt-1 text-xs font-semibold text-gray-400">
                            {formatMusicCount(composer.publishedMusicCount)}
                          </p>
                        </div>
                        <FiArrowRight className="h-5 w-5 shrink-0 text-gray-500 transition group-hover:translate-x-1 group-hover:text-primary-300" />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-primary-400/20 bg-primary-950/30 px-2.5 py-1 text-[11px] font-bold text-primary-100">
                          Premium
                        </span>
                        <span className="text-[11px] font-bold text-gray-500">
                          Ver página
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
