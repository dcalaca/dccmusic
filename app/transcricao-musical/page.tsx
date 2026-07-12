'use client'

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiDownload, FiFileText, FiLoader, FiMusic, FiUpload } from 'react-icons/fi'

type Source = {
  id: string
  projectId: string
  title: string
  versionName: string
  duration: number | null
  createdAt: string
  projectUpdatedAt?: string | null
  isCurrent?: boolean
}

type Transcription = {
  id: string
  title: string
  status: string
  creditsCharged: number
  previewText: string | null
  previewPayload: any
  createdAt: string
  completedAt: string | null
  hasFiles: boolean
}

const COST = 25
const DISPLAY_PRICE = 'R$ 6,90'

function safeFileName(value: string, extension: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'transcricao'

  return `${base}.${extension}`
}

function formatMusicTitle(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s([{'"-])(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`)
}

function formatSourceOption(source: Source) {
  const dateSource = source.projectUpdatedAt || source.createdAt
  const date = dateSource ? new Date(dateSource).toLocaleDateString('pt-BR') : ''
  const versionHint = /^Música gerada #\d+$/.test(source.versionName)
    ? source.versionName.replace('Música gerada', 'Opção')
    : ''
  const parts = [source.title, versionHint, date].filter(Boolean)
  return parts.join(' · ')
}

function sortSourcesNewestFirst(sources: Source[]) {
  return [...sources].sort((a, b) => {
    const dateA = new Date(a.projectUpdatedAt || a.createdAt || 0).getTime()
    const dateB = new Date(b.projectUpdatedAt || b.createdAt || 0).getTime()
    if (dateB !== dateA) return dateB - dateA
    if (Boolean(b.isCurrent) !== Boolean(a.isCurrent)) return Number(b.isCurrent) - Number(a.isCurrent)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })
}

function TranscricaoMusicalContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preferredStudioVersionId = searchParams.get('studioVersionId') || ''
  const preferredStudioProjectId = searchParams.get('studioProjectId') || ''
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'studio' | 'upload'>('studio')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('composer_token') || ''}`,
  }), [])

  const loadData = useCallback(async () => {
    const composerToken = localStorage.getItem('composer_token')
    if (!composerToken) {
      router.push('/compositores/login')
      return
    }

    try {
      setLoading(true)
      setError('')
      const sourcesParams = new URLSearchParams()
      const preferredVersionId = preferredStudioVersionId.trim()
      const preferredProjectId = preferredStudioProjectId.trim()
      if (preferredVersionId) sourcesParams.set('studioVersionId', preferredVersionId)
      if (preferredProjectId) sourcesParams.set('studioProjectId', preferredProjectId)
      const sourcesUrl = sourcesParams.toString()
        ? `/api/compositores/music-transcription/sources?${sourcesParams.toString()}`
        : '/api/compositores/music-transcription/sources'

      const [meResponse, sourcesResponse] = await Promise.all([
        fetch('/api/compositores/me', { headers: { Authorization: `Bearer ${composerToken}` }, cache: 'no-store' }),
        fetch(sourcesUrl, { headers: { Authorization: `Bearer ${composerToken}` }, cache: 'no-store' }),
      ])

      if (meResponse.status === 401 || sourcesResponse.status === 401) {
        router.push('/compositores/login')
        return
      }

      const [meData, sourcesData] = await Promise.all([
        meResponse.json(),
        sourcesResponse.json(),
      ])

      if (!sourcesResponse.ok) throw new Error(sourcesData.error || 'Erro ao carregar suas músicas.')

      const nextSources = sortSourcesNewestFirst(sourcesData.sources || [])
      const nextBalance = Number(meData?.statement?.summary?.currentCreditBalance) || 0
      const preferredId = preferredVersionId
      const preselectedId =
        preferredId && nextSources.some((source) => source.id === preferredId)
          ? preferredId
          : preferredProjectId
            ? nextSources.find((source) => source.projectId === preferredProjectId && source.isCurrent)?.id
              || nextSources.find((source) => source.projectId === preferredProjectId)?.id
              || nextSources[0]?.id
              || ''
            : nextSources[0]?.id || ''

      setSources(nextSources)
      setSelectedSourceId(preselectedId)
      setMode('studio')
      setBalance(nextBalance)
      localStorage.setItem('composer_studio_balance', String(nextBalance))
      window.dispatchEvent(new CustomEvent('studioBalanceChange', { detail: { balance: nextBalance } }))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar partitura e cifra.')
    } finally {
      setLoading(false)
    }
  }, [router, preferredStudioVersionId, preferredStudioProjectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleTranscribeStudio = async () => {
    if (!selectedSourceId) {
      setError('Escolha uma música do Studio IA.')
      return
    }

    const composerToken = localStorage.getItem('composer_token')
    if (!composerToken) {
      router.push('/compositores/login')
      return
    }

    try {
      setProcessing(true)
      setError('')
      setSuccess('')
      const response = await fetch('/api/compositores/music-transcription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${composerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studioVersionId: selectedSourceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar partitura e cifra.')

      setSelectedTranscription(data.transcription)
      setSuccess(data.cached ? 'Partitura e cifra já estavam salvas. Nenhum crédito foi descontado.' : `Partitura e cifra geradas. Debitamos ${COST} créditos do seu saldo DCC.`)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar partitura e cifra.')
    } finally {
      setProcessing(false)
    }
  }

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!manualFile) {
      setError('Escolha o arquivo de áudio.')
      return
    }

    const composerToken = localStorage.getItem('composer_token')
    if (!composerToken) {
      router.push('/compositores/login')
      return
    }

    try {
      setProcessing(true)
      setError('')
      setSuccess('')
      const formData = new FormData()
      formData.append('audio', manualFile)
      formData.append('title', formatMusicTitle(manualTitle.trim()) || manualFile.name)

      const response = await fetch('/api/compositores/music-transcription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${composerToken}` },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar partitura e cifra.')

      setSelectedTranscription(data.transcription)
      setSuccess(data.cached ? 'Partitura e cifra já estavam salvas. Nenhum crédito foi descontado.' : `Partitura e cifra geradas. Debitamos ${COST} créditos do seu saldo DCC.`)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar partitura e cifra.')
    } finally {
      setProcessing(false)
    }
  }

  const downloadFile = async (kind: 'pdf' | 'musicxml' | 'zip' | 'preview-pdf') => {
    if (!selectedTranscription) return
    try {
      setError('')
      const endpoint = kind === 'preview-pdf'
        ? `/api/compositores/music-transcription/preview-pdf?id=${encodeURIComponent(selectedTranscription.id)}`
        : `/api/compositores/music-transcription/file?id=${encodeURIComponent(selectedTranscription.id)}&kind=${kind}`
      const response = await fetch(endpoint, { headers: authHeaders(), cache: 'no-store' })
      const blob = await response.blob()
      if (!response.ok) {
        const message = await blob.text().catch(() => '')
        throw new Error(message || 'Erro ao baixar arquivo.')
      }

      const extension = kind === 'musicxml' ? 'musicxml' : kind === 'zip' ? 'zip' : 'pdf'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = safeFileName(kind === 'preview-pdf' ? `${selectedTranscription.title}-letra-cifra` : selectedTranscription.title, extension)
      if (kind === 'pdf') anchor.target = '_blank'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Erro ao baixar arquivo.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  const canAfford = (balance || 0) >= COST

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden py-4 sm:py-8">
      <div className="container mx-auto max-w-full px-3 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950/40 px-3 py-1 text-xs font-bold text-cyan-200">
              <FiMusic /> Partitura e Cifra
            </div>
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">Transforme áudio em partitura, MusicXML e letra cifrada</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              Escolha uma música do Studio IA ou envie seu áudio. Preço: {DISPLAY_PRICE} por música.
              <span className="block text-xs text-gray-500">Debitamos {COST} créditos do seu saldo DCC.</span>
            </p>
          </div>
          <div className="w-full shrink-0 rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm sm:w-auto sm:px-5 sm:py-4">
            <p className="text-gray-400">Seu saldo</p>
            <p className={`text-2xl font-black ${canAfford ? 'text-green-300' : 'text-yellow-300'}`}>{balance ?? 0} créditos</p>
          </div>
        </div>

        {error && <div className="mb-5 break-words rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="mb-5 break-words rounded-xl border border-green-800 bg-green-950/40 p-4 text-sm text-green-200">{success}</div>}
        {!canAfford && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-yellow-800 bg-yellow-950/40 p-4 text-sm text-yellow-100 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">
              Saldo insuficiente para gerar partitura e cifra.
            </span>
            <Link
              href="/compositores/admin/studio-ia/recarga"
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-black text-black hover:bg-yellow-300 sm:w-auto"
            >
              Comprar créditos para gerar partitura
            </Link>
          </div>
        )}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="min-w-0 space-y-6">
            <div className="min-w-0 rounded-3xl border border-gray-800 bg-gray-950/70 p-4 sm:p-6">
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('studio')}
                  className={`rounded-xl px-3 py-3 text-xs font-black sm:px-4 sm:text-sm ${mode === 'studio' ? 'bg-primary-600 text-white' : 'border border-gray-700 text-gray-300'}`}
                >
                  Música do Studio IA
                </button>
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`rounded-xl px-3 py-3 text-xs font-black sm:px-4 sm:text-sm ${mode === 'upload' ? 'bg-primary-600 text-white' : 'border border-gray-700 text-gray-300'}`}
                >
                  Enviar áudio
                </button>
              </div>

              {mode === 'studio' ? (
                <div>
                  <h2 className="mb-4 text-xl font-bold">Escolha uma música sua</h2>
                  {sources.length === 0 ? (
                    <div className="rounded-xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-300">
                      Nenhuma música com áudio foi encontrada no seu Studio IA.
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedSourceId}
                        onChange={(event) => setSelectedSourceId(event.target.value)}
                        className="mb-4 w-full max-w-full truncate rounded-xl border border-gray-700 bg-black px-3 py-3 text-sm text-white outline-none focus:border-primary-500 sm:px-4 sm:text-base"
                      >
                        {sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {formatSourceOption(source)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleTranscribeStudio}
                        disabled={processing || !canAfford}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processing ? <FiLoader className="animate-spin" /> : <FiFileText />}
                        {processing ? 'Gerando...' : `Gerar partitura e cifra - ${DISPLAY_PRICE}`}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit}>
                  <h2 className="mb-4 text-xl font-bold">Enviar arquivo de áudio</h2>
                  <label className="mb-1.5 block text-sm font-bold text-gray-200">Nome da música</label>
                  <input
                    value={manualTitle}
                    onChange={(event) => setManualTitle(formatMusicTitle(event.target.value))}
                    placeholder="Ex: Minha música"
                    className="mb-4 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-primary-500"
                  />
                  <label className="mb-1.5 block text-sm font-bold text-gray-200">Arquivo</label>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                    onChange={(event) => setManualFile(event.target.files?.[0] || null)}
                    className="mb-2 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                  />
                  <p className="mb-4 text-xs text-gray-500">Formatos aceitos: MP3, WAV, M4A, AAC, FLAC ou OGG. Limite: 50 MB.</p>
                  <button
                    type="submit"
                    disabled={processing || !manualFile || !canAfford}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processing ? <FiLoader className="animate-spin" /> : <FiUpload />}
                    {processing ? 'Enviando...' : `Enviar e gerar - ${DISPLAY_PRICE}`}
                  </button>
                </form>
              )}
            </div>
          </div>

          <section className="min-w-0 rounded-3xl border border-gray-800 bg-gray-950/70 p-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold">Resultado</h2>
            {!selectedTranscription ? (
              <div className="rounded-xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-400">
                Gere uma partitura e cifra para ver o resultado e baixar os arquivos. O histórico fica em Meus Projetos.
              </div>
            ) : (
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3">
                  <button onClick={() => downloadFile('pdf')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
                    <FiFileText /> Baixar partitura PDF
                  </button>
                  <button onClick={() => downloadFile('musicxml')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-sm font-black text-gray-100 hover:border-primary-400">
                    <FiDownload /> Baixar MusicXML
                  </button>
                  <button onClick={() => downloadFile('preview-pdf')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-sm font-black text-gray-100 hover:border-primary-400">
                    <FiDownload /> Salvar letra cifrada em PDF
                  </button>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-800 bg-white p-3 text-gray-950 sm:p-5">
                  <h3 className="mb-3 text-lg font-black">Letra e cifra</h3>
                  <pre className="max-h-[720px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-6 text-gray-950 sm:p-4 sm:text-sm sm:leading-7">
                    {selectedTranscription.previewText || 'Prévia não disponível.'}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default function TranscricaoMusicalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <TranscricaoMusicalContent />
    </Suspense>
  )
}
