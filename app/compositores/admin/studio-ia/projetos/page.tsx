'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiDownload, FiFileText, FiHeart, FiInfo, FiLoader, FiLogIn, FiMic, FiMoreVertical, FiMusic, FiPlus, FiTrash2, FiX, FiZap } from 'react-icons/fi'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'drafts', label: 'Rascunhos' },
  { id: 'published', label: 'Publicados' },
  { id: 'favorites', label: 'Favoritos' },
]

const TRANSCRIPTIONS_FILTER = 'partituras-cifras'

const inspirationVariationOptions = [
  { id: 'similar', label: 'Manter parecido' },
  { id: 'faster', label: 'Um pouco mais rápido' },
  { id: 'energetic', label: 'Mais animado' },
  { id: 'slower_romantic', label: 'Mais lento/romântico' },
]

function formatDuration(value?: number | string | null) {
  const totalSeconds = Math.round(Number(value) || 0)
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR')
}

function safeFileName(value: string, extension: string) {
  const base = String(value || 'partitura-e-cifra')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'partitura-e-cifra'

  return `${base}.${extension}`
}

function StudioProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFilter = searchParams.get('filter') || 'all'
  const [projects, setProjects] = useState<any[]>([])
  const [transcriptions, setTranscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [deletingDrafts, setDeletingDrafts] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [viewMode, setViewMode] = useState<'small' | 'large'>('small')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [menuProjectId, setMenuProjectId] = useState('')
  const [inspiringId, setInspiringId] = useState('')
  const [inspirationProject, setInspirationProject] = useState<any>(null)
  const [selectedInspirationVariation, setSelectedInspirationVariation] = useState('similar')
  const inspirationPickerRef = useRef<HTMLDivElement | null>(null)

  const showSessionExpired = () => {
    localStorage.removeItem('composer_token')
    setProjects([])
    setTranscriptions([])
    setSessionExpired(true)
    setError('Sua sessão expirou ou você foi desconectado. Entre novamente para ver seus projetos.')
  }

  const loadProjects = () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      showSessionExpired()
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSessionExpired(false)

    if (currentFilter === TRANSCRIPTIONS_FILTER) {
      fetch('/api/compositores/music-transcription', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then(async (response) => {
          const data = await response.json()
          if (response.status === 401) {
            showSessionExpired()
            return
          }
          if (!response.ok) throw new Error(data.error || 'Erro ao carregar partituras e cifras')
          setProjects([])
          setTranscriptions(data.transcriptions || [])
        })
        .catch((err) => setError(err.message || 'Erro ao carregar partituras e cifras'))
        .finally(() => setLoading(false))
      return
    }

    setTranscriptions([])
    fetch(`/api/compositores/studio/projects?filter=${currentFilter}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json()
        if (response.status === 401) {
          showSessionExpired()
          return
        }
        if (!response.ok) throw new Error(data.error || 'Erro ao carregar projetos')
        setProjects(data.projects || [])
      })
      .catch((err) => setError(err.message || 'Erro ao carregar projetos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProjects()
  }, [currentFilter])

  const discardDraft = async (projectId: string, projectTitle: string) => {
    const confirmed = window.confirm(`Descartar o rascunho "${projectTitle}"? Essa ação não pode ser desfeita.`)
    if (!confirmed) return

    const token = localStorage.getItem('composer_token')
    if (!token) {
      showSessionExpired()
      return
    }

    setDeletingId(projectId)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/compositores/studio/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.status === 401) {
        showSessionExpired()
        return
      }
      if (!response.ok) throw new Error(data.error || 'Erro ao descartar rascunho')

      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId))
      setMessage('Rascunho descartado.')
    } catch (err: any) {
      setError(err.message || 'Erro ao descartar rascunho')
    } finally {
      setDeletingId('')
    }
  }

  const discardAllDrafts = async () => {
    const draftProjects = projects.filter((project) => project.status === 'draft')
    if (draftProjects.length === 0) return

    const confirmed = window.confirm(`Descartar ${draftProjects.length} rascunho(s)? Essa ação não pode ser desfeita.`)
    if (!confirmed) return

    const token = localStorage.getItem('composer_token')
    if (!token) {
      showSessionExpired()
      return
    }

    setDeletingDrafts(true)
    setError('')
    setMessage('')

    try {
      for (const project of draftProjects) {
        const response = await fetch(`/api/compositores/studio/projects/${project.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (response.status === 401) {
          showSessionExpired()
          return
        }
        if (!response.ok) throw new Error(data.error || `Erro ao descartar "${project.title}"`)
      }

      setProjects((currentProjects) => currentProjects.filter((project) => project.status !== 'draft'))
      setMessage('Rascunhos descartados.')
    } catch (err: any) {
      setError(err.message || 'Erro ao descartar rascunhos')
      loadProjects()
    } finally {
      setDeletingDrafts(false)
    }
  }

  const getProjectVersions = (project: any) => {
    const versions = Array.isArray(project?.versions) ? project.versions : []
    if (versions.length > 0) return versions
    return project?.version ? [project.version] : []
  }

  const openInspirationPicker = (project: any) => {
    setMenuProjectId('')
    setSelectedInspirationVariation('similar')
    setInspirationProject(project)
  }

  const closeInspirationPicker = () => {
    setInspirationProject(null)
  }

  const scrollInspirationPicker = (direction: 'left' | 'right') => {
    inspirationPickerRef.current?.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    })
  }

  const useAsInspiration = async (projectId: string, variation: string, sourceVersionId?: string) => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      showSessionExpired()
      return
    }

    setInspiringId(projectId)
    setError('')
    setMessage('')
    setMenuProjectId('')
    setInspirationProject(null)

    try {
      const response = await fetch(`/api/compositores/studio/projects/${projectId}/inspiration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ variation, sourceVersionId }),
      })
      const data = await response.json()
      if (response.status === 401) {
        showSessionExpired()
        return
      }
      if (!response.ok) throw new Error(data.error || 'Erro ao usar como inspiração')
      router.push(`/compositores/admin/studio-ia/projetos/${data.project.id}`)
    } catch (err: any) {
      setError(err.message || 'Erro ao usar como inspiração')
    } finally {
      setInspiringId('')
    }
  }

  const downloadTranscriptionFile = async (transcription: any, kind: 'pdf' | 'musicxml' | 'zip' | 'preview-pdf') => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      showSessionExpired()
      return
    }

    try {
      setError('')
      const endpoint = kind === 'preview-pdf'
        ? `/api/compositores/music-transcription/preview-pdf?id=${encodeURIComponent(transcription.id)}`
        : `/api/compositores/music-transcription/file?id=${encodeURIComponent(transcription.id)}&kind=${kind}`
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const blob = await response.blob()

      if (!response.ok) {
        const message = await blob.text().catch(() => '')
        throw new Error(message || 'Erro ao baixar arquivo.')
      }

      const extension = kind === 'musicxml' ? 'musicxml' : kind === 'zip' ? 'zip' : 'pdf'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = safeFileName(kind === 'preview-pdf' ? `${transcription.title}-letra-cifra` : transcription.title, extension)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Erro ao baixar arquivo.')
    }
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
            <Link href="/compositores/admin/studio-ia" className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
              <FiArrowLeft /> Voltar
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link href="/compositores/admin/minhas-vozes" className="inline-flex items-center gap-2 rounded-xl border border-purple-700 bg-purple-950/40 px-3 py-2.5 text-sm font-semibold text-purple-100 hover:bg-purple-900/50 sm:px-4 sm:py-3 sm:text-base">
                <FiMic /> Vozes
              </Link>
              <Link href="/compositores/admin/studio-ia/novo" className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-semibold sm:px-4 sm:py-3 sm:text-base">
                <FiPlus /> Criar música
              </Link>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2 text-3xl font-black sm:text-4xl">
              <span className="gradient-text">Meus Projetos</span>
            </h1>
            <p className="text-gray-400">Organize suas músicas por rascunhos, publicadas e favoritas.</p>
          </div>

          {message && <div className="mb-6 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}
          {inspirationProject && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 px-3 py-5 backdrop-blur-sm sm:px-6">
              <div className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-purple-400/30 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#050816,#090b16,#18092c)] shadow-2xl shadow-purple-950/50">
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">Usar de inspiração</p>
                    <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">Qual versão você quer usar?</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
                      Ouça as músicas de “{inspirationProject.title}” e escolha a versão que deve servir de base.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeInspirationPicker}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 p-2 text-gray-300 transition hover:text-white sm:static"
                    aria-label="Fechar"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="border-b border-white/10 px-4 py-3 sm:px-5">
                  <p className="mb-2 text-xs font-bold text-purple-100">Como quer a nova versão?</p>
                  <div className="flex flex-wrap gap-2">
                    {inspirationVariationOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedInspirationVariation(option.id)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selectedInspirationVariation === option.id ? 'border-primary-300 bg-primary-600 text-white' : 'border-purple-800/70 bg-black/25 text-purple-100 hover:border-purple-500'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => scrollInspirationPicker('left')}
                    className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/65 p-3 text-white shadow-xl transition hover:bg-purple-900/70 lg:inline-flex"
                    aria-label="Ver versão anterior"
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollInspirationPicker('right')}
                    className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/65 p-3 text-white shadow-xl transition hover:bg-purple-900/70 lg:inline-flex"
                    aria-label="Ver próxima versão"
                  >
                    <FiChevronRight />
                  </button>

                  <div ref={inspirationPickerRef} className="flex max-h-[58vh] snap-x gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-3 pr-1">
                    {getProjectVersions(inspirationProject).map((version: any, index: number) => {
                      const audioUrl = version.audioUrl || version.streamAudioUrl
                      const duration = formatDuration(version.duration)
                      const versionNumber = getProjectVersions(inspirationProject).length - index

                      return (
                        <article key={version.id || index} className="min-w-[82vw] snap-center rounded-3xl border border-purple-400/20 bg-black/35 p-4 shadow-xl shadow-black/30 sm:min-w-[26rem] lg:min-w-[30rem]">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-green-300">Música gerada #{versionNumber}</p>
                              <h3 className="mt-1 line-clamp-2 font-black text-white">
                                {version.versionName || version.style || 'Versão gerada'}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {version.createdAt ? new Date(version.createdAt).toLocaleString('pt-BR') : ''}
                                {duration ? ` · Duração ${duration}` : ''}
                              </p>
                            </div>
                            {version.isCurrent && (
                              <span className="rounded-full bg-green-950 px-3 py-1 text-xs font-bold text-green-300">
                                atual
                              </span>
                            )}
                          </div>

                          {audioUrl ? (
                            <audio controls src={audioUrl} className="w-full" />
                          ) : (
                            <p className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-500">Áudio sem URL registrada.</p>
                          )}

                          <button
                            type="button"
                            onClick={() => useAsInspiration(inspirationProject.id, selectedInspirationVariation, version.id)}
                            disabled={Boolean(inspiringId) || !audioUrl}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-black text-white transition hover:scale-[1.01] disabled:opacity-60"
                          >
                            {inspiringId ? <FiLoader className="animate-spin" /> : <FiMusic />}
                            Usar esta versão
                          </button>
                        </article>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-500 lg:hidden">
                    Arraste para o lado para ver outras versões.
                  </p>
                </div>
              </div>
            </div>
          )}
          {sessionExpired && (
            <div className="mb-6 rounded-2xl border border-primary-800 bg-primary-950/30 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Sessão encerrada</h2>
                  <p className="text-sm text-gray-300">
                    Você estava logado, mas a sessão expirou. Clique abaixo para entrar novamente.
                  </p>
                </div>
                <Link
                  href="/compositores/login?redirect=/compositores/admin/studio-ia/projetos"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-500"
                >
                  <FiLogIn />
                  Entrar novamente
                </Link>
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <aside className="flex h-fit gap-2 overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/70 p-2 [scrollbar-width:none] lg:block lg:space-y-1 lg:p-4 [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2 lg:block lg:space-y-1">
                {filters.map((filter) => (
                  <Link
                    key={filter.id}
                    href={`/compositores/admin/studio-ia/projetos?filter=${filter.id}`}
                    className={`block shrink-0 rounded-xl px-4 py-3 text-sm transition ${
                      currentFilter === filter.id ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
              <div className="hidden border-t border-gray-800 pt-3 lg:mt-3 lg:block">
                <Link
                  href="/compositores/admin/minhas-vozes"
                  className="flex items-center gap-2 rounded-xl border border-purple-800/70 bg-purple-950/25 px-4 py-3 text-sm font-bold text-purple-100 transition hover:border-purple-400 hover:bg-purple-900/40"
                >
                  <FiMic />
                  <span>Minhas vozes</span>
                  <span className="group relative ml-auto inline-flex">
                    <FiInfo className="h-4 w-4 text-purple-200" />
                    <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-56 rounded-xl border border-purple-700/60 bg-gray-950 px-3 py-2 text-xs font-medium leading-relaxed text-purple-100 shadow-xl shadow-black/40 group-hover:block">
                      Ouça e gerencie as vozes que você cadastrou.
                    </span>
                  </span>
                </Link>
                <Link
                  href={`/compositores/admin/studio-ia/projetos?filter=${TRANSCRIPTIONS_FILTER}`}
                  className={`mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    currentFilter === TRANSCRIPTIONS_FILTER
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-amber-800/70 bg-amber-950/20 text-amber-100 hover:border-amber-400 hover:bg-amber-900/30'
                  }`}
                >
                  <FiFileText />
                  Partituras e Cifras
                </Link>
              </div>
              <Link
                href="/compositores/admin/minhas-vozes"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-purple-800/70 bg-purple-950/25 px-4 py-3 text-sm font-bold text-purple-100 transition hover:border-purple-400 lg:hidden"
              >
                <FiMic />
                Minhas vozes
              </Link>
              <Link
                href={`/compositores/admin/studio-ia/projetos?filter=${TRANSCRIPTIONS_FILTER}`}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition lg:hidden ${
                  currentFilter === TRANSCRIPTIONS_FILTER
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-amber-800/70 bg-amber-950/20 text-amber-100 hover:border-amber-400'
                }`}
              >
                <FiFileText />
                Partituras e Cifras
              </Link>
            </aside>

            <section>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid w-full grid-cols-2 rounded-xl border border-gray-800 bg-gray-950/70 p-1 sm:inline-flex sm:w-fit">
                  <button
                    type="button"
                    onClick={() => setViewMode('small')}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      viewMode === 'small' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Cards pequenos
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('large')}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      viewMode === 'large' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Cards grandes
                  </button>
                </div>

                {currentFilter === 'drafts' && projects.some((project) => project.status === 'draft') && (
                  <button
                    type="button"
                    onClick={discardAllDrafts}
                    disabled={deletingDrafts}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-950/60 disabled:opacity-60"
                  >
                    {deletingDrafts ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                    Descartar rascunhos
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">
                  {currentFilter === TRANSCRIPTIONS_FILTER ? 'Carregando partituras e cifras...' : 'Carregando projetos...'}
                </div>
              ) : currentFilter === TRANSCRIPTIONS_FILTER ? (
                transcriptions.length === 0 ? (
                  <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center">
                    <p className="mb-4 text-gray-400">Nenhuma partitura ou cifra salva ainda.</p>
                    <Link href="/transcricao-musical" className="inline-flex rounded-xl bg-primary-600 px-5 py-3 font-semibold">
                      Criar partitura e cifra
                    </Link>
                  </div>
                ) : (
                  <div className={viewMode === 'small' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5' : 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3'}>
                    {transcriptions.map((item) => (
                      <div key={item.id} className="group overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70 transition hover:border-amber-500">
                        <div className={`relative flex items-center justify-center bg-gradient-to-br from-amber-950 via-purple-950 to-black ${viewMode === 'small' ? 'aspect-[4/3]' : 'aspect-square'}`}>
                          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/30 bg-amber-400/10 text-amber-100">
                            <FiFileText className="h-8 w-8" />
                          </div>
                          <span className="absolute bottom-3 left-3 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-amber-100">
                            Partitura e cifra
                          </span>
                        </div>
                        <div className={viewMode === 'small' ? 'p-3' : 'p-4'}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className={`truncate font-bold group-hover:text-amber-200 ${viewMode === 'small' ? 'text-sm' : ''}`}>{item.title}</h3>
                            <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] uppercase text-gray-300">
                              salva
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{formatDate(item.completedAt || item.createdAt)}</p>
                          <div className="mt-3 grid gap-2">
                            <button
                              type="button"
                              onClick={() => downloadTranscriptionFile(item, 'pdf')}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-500"
                            >
                              <FiDownload /> Partitura PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadTranscriptionFile(item, 'preview-pdf')}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-xs font-bold text-gray-100 hover:border-amber-400"
                            >
                              <FiDownload /> Letra cifrada PDF
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => downloadTranscriptionFile(item, 'musicxml')}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-xs font-bold text-gray-100 hover:border-amber-400"
                              >
                                MusicXML
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadTranscriptionFile(item, 'zip')}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-xs font-bold text-gray-100 hover:border-amber-400"
                              >
                                ZIP
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : projects.length === 0 ? (
                <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center">
                  <p className="text-gray-400 mb-4">Nenhum projeto nesta categoria.</p>
                  <Link href="/compositores/admin/studio-ia/novo" className="inline-flex rounded-xl bg-primary-600 px-5 py-3 font-semibold">
                    Criar nova música
                  </Link>
                </div>
              ) : (
                <div className={viewMode === 'small' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5' : 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3'}>
                  {projects.map((project) => (
                    <div key={project.id} className="group relative overflow-visible rounded-2xl border border-gray-800 bg-gray-950/70 transition hover:border-primary-500">
                      <div className="absolute right-2 top-2 z-20">
                        <button
                          type="button"
                          onClick={() => setMenuProjectId(menuProjectId === project.id ? '' : project.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-black/80 text-white shadow-lg hover:border-primary-400"
                          aria-label="Opções da música"
                        >
                          {inspiringId === project.id ? <FiLoader className="animate-spin" /> : <FiMoreVertical />}
                        </button>
                        {menuProjectId === project.id && (
                          <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/50">
                            <button
                              type="button"
                              onClick={() => openInspirationPicker(project)}
                              disabled={inspiringId === project.id}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-gray-100 hover:bg-gray-900 disabled:opacity-60"
                            >
                              <FiZap />
                              Usar de inspiração
                            </button>
                          </div>
                        )}
                      </div>
                      <Link href={`/compositores/admin/studio-ia/projetos/${project.id}`}>
                        <div className={`relative bg-gradient-to-br from-gray-900 to-purple-950 ${viewMode === 'small' ? 'aspect-[4/3]' : 'aspect-square'}`}>
                          {project.cover?.imageUrl && (
                            <img
                              src={project.cover.imageUrl}
                              alt={project.title}
                              onError={(event) => {
                                event.currentTarget.style.display = 'none'
                              }}
                              className="h-full w-full object-cover"
                            />
                          )}
                          {project.favorite && <FiHeart className="absolute right-3 top-3 h-5 w-5 fill-red-400 text-red-400" />}
                          {project.versionCount > 1 && (
                            <span className="absolute bottom-3 left-3 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-green-200">
                              {project.versionCount} músicas
                            </span>
                          )}
                        </div>
                        <div className={viewMode === 'small' ? 'p-3 pb-2' : 'p-4 pb-3'}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className={`truncate font-bold group-hover:text-primary-300 ${viewMode === 'small' ? 'text-sm' : ''}`}>{project.title}</h3>
                            <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] uppercase text-gray-300">
                              {project.status}
                            </span>
                          </div>
                          <p className={viewMode === 'small' ? 'truncate text-xs text-gray-400' : 'text-sm text-gray-400'}>{project.style || 'Livre'} · {project.mood || 'Sem clima'}</p>
                          {project.versionCount > 1 && (
                            <p className="mt-2 rounded-lg border border-green-900/50 bg-green-950/20 px-2 py-1 text-xs font-bold text-green-200">
                              Abra para escolher entre {project.versionCount} versões geradas
                            </p>
                          )}
                          <p className="mt-2 text-xs text-gray-500">
                            {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </Link>
                      {project.status === 'draft' && (
                        <div className={viewMode === 'small' ? 'px-3 pb-3' : 'px-4 pb-4'}>
                          <button
                            type="button"
                            onClick={() => discardDraft(project.id, project.title)}
                            disabled={deletingId === project.id || deletingDrafts}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-950/60 disabled:opacity-60"
                          >
                            {deletingId === project.id ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                            Descartar rascunho
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StudioProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    }>
      <StudioProjectsContent />
    </Suspense>
  )
}
