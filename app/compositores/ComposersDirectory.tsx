'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiSearch,
  FiStar,
} from 'react-icons/fi'

export type DirectoryComposer = {
  id: string
  name: string
  slug: string
  publishedMusicCount?: number
  profilePhotoUrl?: string | null
}

type SortOption = 'most' | 'least' | 'az'

const PAGE_SIZE = 12

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

function ComposerAvatar({
  name,
  photoUrl,
  priority = false,
}: {
  name: string
  photoUrl?: string | null
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const initials = getInitials(name)
  const showPhoto = Boolean(photoUrl) && !failed

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-600 to-purple-600 text-sm font-black text-white ring-2 ring-white/10">
      <span aria-hidden={showPhoto}>{initials}</span>
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt={`Foto de ${name}`}
          width={56}
          height={56}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}

export default function ComposersDirectory({ composers }: { composers: DirectoryComposer[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('most')
  const [page, setPage] = useState(1)

  const rankedIds = useMemo(() => {
    return [...composers]
      .sort((a, b) => {
        const countDiff = (Number(b.publishedMusicCount) || 0) - (Number(a.publishedMusicCount) || 0)
        if (countDiff !== 0) return countDiff
        return a.name.localeCompare(b.name, 'pt-BR')
      })
      .slice(0, 3)
      .map((composer) => composer.id)
  }, [composers])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    let list = composers.filter((composer) => {
      if (!normalized) return true
      return composer.name.toLowerCase().includes(normalized)
    })

    list = [...list].sort((a, b) => {
      if (sort === 'az') return a.name.localeCompare(b.name, 'pt-BR')
      const aCount = Number(a.publishedMusicCount) || 0
      const bCount = Number(b.publishedMusicCount) || 0
      if (sort === 'least') {
        if (aCount !== bCount) return aCount - bCount
        return a.name.localeCompare(b.name, 'pt-BR')
      }
      if (aCount !== bCount) return bCount - aCount
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    return list
  }, [composers, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const sortLabel =
    sort === 'az' ? 'A–Z' : sort === 'least' ? 'Menos músicas' : 'Mais músicas'

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-white sm:text-2xl">Todos os compositores</h2>
          <p className="mt-1 text-sm text-gray-400">
            {sort === 'az'
              ? 'Ordenados por nome.'
              : sort === 'least'
                ? 'Ordenados por menor quantidade de músicas publicadas.'
                : 'Ordenados por quantidade de músicas publicadas.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <label className="relative block w-full sm:min-w-[220px] lg:w-64">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar compositor..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-purple-400/50"
            />
          </label>

          <label className="relative block w-full sm:w-48">
            <FiFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortOption)
                setPage(1)
              }}
              aria-label={`Ordenar: ${sortLabel}`}
              className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-8 text-sm font-semibold text-white outline-none transition focus:border-purple-400/50"
            >
              <option value="most">Mais músicas</option>
              <option value="least">Menos músicas</option>
              <option value="az">A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-gray-300">Nenhum compositor encontrado para essa busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((composer, itemIndex) => {
            const rankIndex = rankedIds.indexOf(composer.id)
            const isTop = rankIndex >= 0
            const isFirst = rankIndex === 0

            return (
              <Link
                key={composer.id}
                href={`/compositores/${composer.slug}`}
                className={`group relative rounded-2xl border p-4 transition hover:bg-white/[0.04] ${
                  isFirst
                    ? 'border-purple-400/50 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black shadow-[0_0_28px_rgba(168,85,247,0.22)]'
                    : 'border-white/10 bg-black/30 hover:border-purple-400/35'
                }`}
              >
                <div className="absolute right-3 top-3 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-purple-300">
                  <FiArrowRight className="h-4 w-4" />
                </div>

                <div className="flex items-start gap-3 pr-6">
                  <ComposerAvatar
                    name={composer.name}
                    photoUrl={composer.profilePhotoUrl}
                    priority={itemIndex < 4}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-base font-black text-white transition group-hover:text-purple-200">
                        {composer.name}
                      </h3>
                      {isTop && <FiStar className="h-3.5 w-3.5 shrink-0 text-purple-300" />}
                    </div>

                    {isTop ? (
                      <span className="mt-1 inline-flex rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-black text-purple-100">
                        Destaque #{rankIndex + 1}
                      </span>
                    ) : null}

                    <p className="mt-2 text-xs font-semibold text-gray-400">
                      {formatMusicCount(composer.publishedMusicCount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-purple-400/25 bg-purple-950/40 px-2.5 py-1 text-[11px] font-bold text-purple-100">
                    Premium
                  </span>
                  <span className="text-[11px] font-bold text-gray-400 transition group-hover:text-purple-200">
                    Ver página →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-300 transition hover:border-purple-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-bold transition ${
                pageNumber === currentPage
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'border border-white/10 bg-black/40 text-gray-300 hover:border-purple-400/40 hover:text-white'
              }`}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-gray-300 transition hover:border-purple-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Próxima página"
          >
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}
