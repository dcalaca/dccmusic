'use client'

import { useEffect, useState } from 'react'
import { FiLoader, FiMusic, FiUpload } from 'react-icons/fi'
import {
  STUDIO_STEM_SEPARATION_CREDITS,
} from './pricing'

type ProjectOption = {
  id: string
  title: string
  versions: Array<{ id: string; audioUrl?: string | null; versionName?: string | null }>
}

type StudioSourcePickerProps = {
  token: string
  creditsRemaining: number | null
  onStarted: (jobId: string) => void
}

export default function StudioSourcePicker({
  token,
  creditsRemaining,
  onStarted,
}: StudioSourcePickerProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/compositores/studio/projects', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao carregar projetos')
        if (cancelled) return
        const list = (data.projects || [])
          .map((project: any) => ({
            id: project.id,
            title: project.title,
            versions: (project.versions || []).filter((version: any) =>
              Boolean(version.audioUrl || version.streamAudioUrl)
            ),
          }))
          .filter((project: ProjectOption) => project.versions.length > 0)
        setProjects(list)
        if (list[0]) {
          setSelectedProjectId(list[0].id)
          setSelectedVersionId(list[0].versions[0]?.id || '')
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Erro ao carregar projetos')
      } finally {
        if (!cancelled) setLoadingProjects(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null

  useEffect(() => {
    if (!selectedProject) return
    if (!selectedProject.versions.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(selectedProject.versions[0]?.id || '')
    }
  }, [selectedProject, selectedVersionId])

  const canSubmit = Boolean(audioFile || (selectedProjectId && selectedVersionId))
  const lowCredits =
    creditsRemaining !== null && creditsRemaining < STUDIO_STEM_SEPARATION_CREDITS

  const startSeparation = async () => {
    setSubmitting(true)
    setError('')
    try {
      let response: Response
      if (audioFile) {
        const form = new FormData()
        form.append('audio', audioFile)
        form.append('title', audioFile.name.replace(/\.[^.]+$/, ''))
        response = await fetch('/api/compositores/studio/stems/separate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
      } else {
        response = await fetch('/api/compositores/studio/stems/separate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: selectedProjectId,
            versionId: selectedVersionId,
          }),
        })
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao iniciar separação')
      onStarted(data.jobId)
    } catch (err: any) {
      setError(err.message || 'Erro ao separar')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
          DCC Studio
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Separar instrumentos</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Escolha uma música dos seus projetos ou envie um áudio. A separação usa IA (Suno, com fallback Mureka).
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Separar instrumentos custa <strong>{STUDIO_STEM_SEPARATION_CREDITS} créditos</strong> (mesmo valor de criar uma música).
        É neste passo que temos custo com a IA. Ajustes de volume/mute no mixer são grátis.
        {creditsRemaining !== null && (
          <span className="mt-1 block text-xs text-amber-200/80">
            Seu saldo atual: {creditsRemaining} créditos.
          </span>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
          <FiMusic className="h-4 w-4 text-primary-400" />
          Música do Studio IA
        </div>
        {loadingProjects ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <FiLoader className="h-4 w-4 animate-spin" /> Carregando projetos...
          </p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum projeto com áudio encontrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value)
                setAudioFile(null)
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            {selectedProject && (
              <select
                value={selectedVersionId}
                onChange={(e) => {
                  setSelectedVersionId(e.target.value)
                  setAudioFile(null)
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {selectedProject.versions.map((version, index) => (
                  <option key={version.id} value={version.id}>
                    {version.versionName || `Versão ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
          <FiUpload className="h-4 w-4 text-primary-400" />
          Ou enviar áudio
        </div>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            setAudioFile(file)
          }}
          className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-zinc-100"
        />
        {audioFile && (
          <p className="mt-2 text-xs text-zinc-500">Selecionado: {audioFile.name}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit || submitting || lowCredits}
        onClick={() => setConfirmOpen(true)}
        className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {lowCredits
          ? `Saldo insuficiente (${STUDIO_STEM_SEPARATION_CREDITS} créditos necessários)`
          : `Separar instrumentos (${STUDIO_STEM_SEPARATION_CREDITS} créditos)`}
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Confirmar separação</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Separar instrumentos custa <strong>{STUDIO_STEM_SEPARATION_CREDITS} créditos</strong> (mesmo valor de criar uma música).
              É neste passo que temos custo com a IA.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={startSeparation}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
              >
                {submitting && <FiLoader className="h-4 w-4 animate-spin" />}
                Confirmar e debitar {STUDIO_STEM_SEPARATION_CREDITS}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
