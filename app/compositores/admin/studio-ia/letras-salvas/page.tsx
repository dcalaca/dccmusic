'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiChevronDown, FiChevronLeft, FiChevronRight, FiEdit2, FiFileText, FiLoader } from 'react-icons/fi'
import CopyButton from '@/components/CopyButton'

type SavedLyric = { id: string; projectId: string; title: string; content: string; updatedAt: string }

export default function SavedLyricsPage() {
  const { t, i18n } = useTranslation()
  const [lyrics, setLyrics] = useState<SavedLyric[]>([])
  const [openLyricId, setOpenLyricId] = useState('')
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('composer_token')
        if (!token) { setSessionExpired(true); return }
        const response = await fetch(`/api/compositores/studio/saved-lyrics?page=${page}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
        })
        if (response.status === 401) { setSessionExpired(true); setLyrics([]); return }
        if (!response.ok) throw new Error('load')
        const data = await response.json()
        setLyrics(data.lyrics)
        setHasMore(data.hasMore)
      } catch {
        if (!controller.signal.aborted) setError('studio.savedLyrics.loadError')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [page, retry])

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-3 pb-16 pt-5 text-white sm:px-4">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/compositores/admin/studio-ia" aria-label={t('common.actions.back')} title={t('common.actions.back')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
          <FiArrowLeft />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">{t('studio.savedLyrics.title')}</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{t('studio.savedLyrics.description')}</p>
        </div>
      </header>
      {sessionExpired ? (
        <div>
          <p className="mb-4 text-gray-300">{t('studio.projects.errors.sessionExpired')}</p>
          <Link href="/compositores/login" className="inline-block rounded-xl bg-primary-600 px-5 py-3">{t('emailMagic.signIn')}</Link>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">
          <p>{t(error)}</p>
          <button onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-lg bg-gray-800 px-4 py-2 text-white">{t('common.actions.tryAgain')}</button>
        </div>
      ) : loading ? (
        <p role="status" className="flex items-center gap-2 py-8"><FiLoader className="animate-spin" />{t('common.status.loading')}</p>
      ) : lyrics.length === 0 ? (
        <p className="rounded-2xl border border-gray-800 p-6 text-gray-300">{t('studio.savedLyrics.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080b12] shadow-xl shadow-black/20">
          {lyrics.map((lyric) => {
            const expanded = openLyricId === lyric.id
            return (
              <article key={lyric.id} className="border-b border-white/[0.06] last:border-b-0">
                <div className={`flex items-center gap-1 px-2 transition sm:px-3 ${expanded ? 'bg-primary-500/[0.06]' : 'hover:bg-white/[0.025]'}`}>
                  <button type="button" aria-expanded={expanded} aria-controls={`lyric-${lyric.id}`} onClick={() => setOpenLyricId(expanded ? '' : lyric.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pl-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                    <FiFileText className="hidden h-4 w-4 shrink-0 text-primary-400/70 sm:block" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-100">{lyric.title}</span>
                      <span className="mt-0.5 block text-[10px] tabular-nums text-gray-500">{new Date(lyric.updatedAt).toLocaleDateString(i18n.language)}</span>
                    </span>
                    <FiChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180 text-primary-300' : ''}`} />
                  </button>
                  <CopyButton iconOnly text={lyric.content} label={t('studio.savedLyrics.copy')} />
                  <Link href={`/compositores/admin/studio-ia/projetos/${lyric.projectId}#letra`} aria-label={t('studio.savedLyrics.openProject')} title={t('studio.savedLyrics.openProject')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:h-8 sm:w-8">
                    <FiEdit2 className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div id={`lyric-${lyric.id}`} hidden={!expanded} className="border-t border-white/[0.06] bg-black/20 px-4 py-4 sm:pl-11">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{lyric.content}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {!sessionExpired && !error && (
        <nav aria-label={t('studio.savedLyrics.title')} className="mt-3 flex items-center justify-end gap-1 text-xs text-gray-400">
          <button aria-label={t('studio.savedLyrics.previous')} title={t('studio.savedLyrics.previous')} disabled={page === 0 || loading} onClick={() => { setOpenLyricId(''); setPage(value => value - 1) }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-25"><FiChevronLeft /></button>
          <span className="min-w-6 text-center tabular-nums">{page + 1}</span>
          <button aria-label={t('studio.savedLyrics.next')} title={t('studio.savedLyrics.next')} disabled={!hasMore || loading} onClick={() => { setOpenLyricId(''); setPage(value => value + 1) }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-25"><FiChevronRight /></button>
        </nav>
      )}
    </main>
  )
}
