'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { FiDownload, FiLoader, FiMenu, FiSave, FiX } from 'react-icons/fi'
import { ProjectProvider, useStudioProject } from './ProjectProvider'
import StudioMixer from './StudioMixer'
import StudioPlayer from './StudioPlayer'
import StudioSidebar from './StudioSidebar'
import StudioSourcePicker from './StudioSourcePicker'
import { STUDIO_STEM_EXPORT_CREDITS } from './pricing'
import type { Stem, StudioProject } from './types'

function StudioShell({
  token,
  onReset,
}: {
  token: string
  onReset: () => void
}) {
  const { project, stems, jobId, trim } = useStudioProject()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [exportConfirm, setExportConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [projectUrl, setProjectUrl] = useState<string | null>(null)

  const exportMix = async () => {
    if (!jobId) return
    setExporting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/compositores/studio/stems/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          trim,
          stems: stems.map((stem) => ({
            id: stem.id,
            type: stem.type,
            volume: stem.volume,
            muted: stem.muted,
            solo: stem.solo,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao exportar')
      setMessage(data.message || 'Exportação concluída.')
      setProjectUrl(data.projectUrl || null)
      setExportConfirm(false)
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="-mx-0 flex h-[calc(100dvh-4.5rem)] min-h-[520px] flex-col overflow-hidden bg-black text-white md:h-[calc(100dvh-5rem)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          className="rounded-lg border border-zinc-800 p-2 text-zinc-300 lg:hidden"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={sidebarOpen ? 'Fechar painel' : 'Abrir painel'}
        >
          {sidebarOpen ? <FiX className="h-4 w-4" /> : <FiMenu className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
            DCC Studio
          </p>
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">
            {project.title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="hidden rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 sm:inline-flex"
          >
            Nova separação
          </button>
          <button
            type="button"
            onClick={() => setMessage('Salvar versão no mixer ainda não está disponível. Use Exportar.')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 sm:px-3"
          >
            <FiSave className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salvar versão</span>
            <span className="sm:hidden">Salvar</span>
          </button>
          <button
            type="button"
            onClick={() => setExportConfirm(true)}
            disabled={!jobId || exporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-zinc-700 sm:px-3"
          >
            <FiDownload className="h-3.5 w-3.5" />
            <span>Exportar</span>
          </button>
        </div>
      </header>

      {(message || error || projectUrl) && (
        <div className="shrink-0 border-b border-zinc-800 px-3 py-2 text-xs sm:px-4">
          {error && <p className="text-red-300">{error}</p>}
          {message && <p className="text-emerald-300">{message}</p>}
          {projectUrl && (
            <Link href={projectUrl} className="mt-1 inline-block text-primary-300 underline">
              Abrir no seus projetos
            </Link>
          )}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div
          className={`absolute inset-y-0 left-0 z-20 w-[min(100%,300px)] transform border-r border-zinc-800 bg-zinc-950 transition-transform lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <StudioSidebar />
        </div>
        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/60 lg:hidden"
            aria-label="Fechar painel"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="hidden h-full lg:flex">
          <StudioSidebar />
        </div>

        <StudioMixer />
      </div>

      <StudioPlayer />

      {exportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Exportar mix</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Exportar e salvar a nova versão no seu projeto custa{' '}
              <strong>{STUDIO_STEM_EXPORT_CREDITS} crédito</strong>.
              Cortar o trecho é grátis. Baixar de novo a mesma mix (mesmo corte e volumes) é grátis.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportConfirm(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={exportMix}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
              >
                {exporting && <FiLoader className="h-4 w-4 animate-spin" />}
                Confirmar exportação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudioApp({ projectId }: { projectId?: string }) {
  const { loadJob, jobId } = useStudioProject()
  const [token, setToken] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [phase, setPhase] = useState<'picker' | 'processing' | 'mixer'>('picker')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('composer_token')
    setToken(stored)
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const response = await fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (response.ok) {
          setCreditsRemaining(Number(data?.credits?.remaining ?? null))
        }
      } catch {
        // ignore
      }
    })()
  }, [token, phase])

  const hydrateJob = useCallback(async (jobIdToLoad: string, authToken: string) => {
    const response = await fetch(`/api/compositores/studio/stems/jobs/${jobIdToLoad}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Erro ao carregar job')

    if (data.job.status === 'failed') {
      throw new Error(data.job.error || 'Separação falhou. Créditos foram estornados se cobrados.')
    }

    if (data.job.status !== 'ready') {
      return { ready: false as const, status: data.job.status as string }
    }

    const project: StudioProject = {
      id: data.job.projectId || projectId || jobIdToLoad,
      title: data.job.sourceTitle || 'Mix Studio',
      artist: 'DCC Music',
      coverUrl: null,
      audioUrl: data.job.sourceAudioUrl || null,
    }

    const stems: Stem[] = (data.stems || []).map((stem: any) => ({
      id: stem.id,
      name: stem.name,
      type: stem.type,
      volume: stem.volume ?? 70,
      muted: false,
      solo: false,
      url: stem.url || null,
    }))

    loadJob({ jobId: jobIdToLoad, project, stems })
    return { ready: true as const }
  }, [loadJob, projectId])

  useEffect(() => {
    if (!token || !activeJobId || phase !== 'processing') return

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      try {
        attempts += 1
        setStatusMessage('Separando instrumentos com IA... Isso pode levar alguns minutos.')
        const result = await hydrateJob(activeJobId, token)
        if (cancelled) return
        if (result.ready) {
          setPhase('mixer')
          return
        }
        if (attempts > 90) {
          setError('A separação está demorando mais que o esperado. Atualize a página e tente abrir o job novamente.')
          return
        }
        setTimeout(poll, 4000)
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Erro na separação')
          setPhase('picker')
          setActiveJobId(null)
        }
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [token, activeJobId, phase, hydrateJob])

  // Se já houver job na URL futura — por enquanto projectId só pré-seleciona título mock até separar
  useEffect(() => {
    if (jobId) setPhase('mixer')
  }, [jobId])

  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400">
        <FiLoader className="mr-2 h-4 w-4 animate-spin" /> Carregando...
      </div>
    )
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">DCC Studio (interno)</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Faça login como compositor para testar a separação de instrumentos.
        </p>
        <Link
          href="/compositores/login?redirect=/studio/mixer"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Entrar
        </Link>
      </div>
    )
  }

  if (phase === 'processing') {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <FiLoader className="h-8 w-8 animate-spin text-primary-400" />
        <p className="text-sm text-zinc-300">{statusMessage}</p>
        <p className="text-xs text-zinc-600">Job: {activeJobId}</p>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    )
  }

  if (phase === 'picker') {
    return (
      <div>
        {error && (
          <div className="mx-auto max-w-2xl px-4 pt-4">
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          </div>
        )}
        <StudioSourcePicker
          token={token}
          creditsRemaining={creditsRemaining}
          onStarted={(newJobId) => {
            setError('')
            setActiveJobId(newJobId)
            setPhase('processing')
          }}
        />
      </div>
    )
  }

  return (
    <StudioShell
      token={token}
      onReset={() => {
        setPhase('picker')
        setActiveJobId(null)
        setError('')
      }}
    />
  )
}

type StudioPageProps = {
  projectId?: string
}

export default function StudioPage({ projectId }: StudioPageProps) {
  return (
    <ProjectProvider projectId={projectId}>
      <StudioApp projectId={projectId} />
    </ProjectProvider>
  )
}
