'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiFileText, FiLoader } from 'react-icons/fi'
import CopyButton from '@/components/CopyButton'

type SavedLyric = { id: string; projectId: string; title: string; content: string; updatedAt: string }

export default function SavedLyricsPage() {
  const { t, i18n } = useTranslation()
  const [lyrics, setLyrics] = useState<SavedLyric[]>([])
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
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-8 text-white">
      <Link href="/compositores/admin/studio-ia" className="inline-flex items-center gap-2 text-gray-300 hover:text-white">
        <FiArrowLeft /> {t('common.actions.back')}
      </Link>
      <h1 className="mt-6 flex items-center gap-3 text-3xl font-black"><FiFileText /> {t('studio.savedLyrics.title')}</h1>
      <p className="mb-6 mt-2 text-gray-400">{t('studio.savedLyrics.description')}</p>
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
        <div className="space-y-5">
          {lyrics.map((lyric) => (
            <article key={lyric.id} className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4 sm:p-6">
              <h2 className="text-xl font-bold">{lyric.title}</h2>
              <p className="mt-1 text-xs text-gray-400">{new Date(lyric.updatedAt).toLocaleDateString(i18n.language)}</p>
              <div className="my-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div><CopyButton text={lyric.content} label={t('studio.savedLyrics.copy')} /></div>
                <Link href={`/compositores/admin/studio-ia/projetos/${lyric.projectId}#letra`} className="rounded-lg border border-gray-700 px-4 py-2 text-center text-sm hover:bg-gray-800">{t('studio.savedLyrics.openProject')}</Link>
              </div>
              <details>
                <summary className="cursor-pointer text-primary-300">{t('studio.savedLyrics.view')}</summary>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">{lyric.content}</p>
              </details>
            </article>
          ))}
        </div>
      )}
      {!sessionExpired && !error && (
        <div className="mt-6 flex justify-between gap-3">
          <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)} className="rounded-xl bg-gray-800 px-4 py-2 disabled:opacity-40">{t('studio.savedLyrics.previous')}</button>
          <button disabled={!hasMore || loading} onClick={() => setPage(page + 1)} className="rounded-xl bg-gray-800 px-4 py-2 disabled:opacity-40">{t('studio.savedLyrics.next')}</button>
        </div>
      )}
    </main>
  )
}
