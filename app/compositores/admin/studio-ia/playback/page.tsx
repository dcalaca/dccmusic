'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiArrowLeft, FiCheckCircle, FiDownload, FiFolder, FiHeadphones, FiLoader, FiMusic, FiRefreshCw, FiUploadCloud } from 'react-icons/fi'
import { useLocalization } from '@/components/LocalizationProvider'

const PLAYBACK_CREDITS = 10

function PlaybackCreator() {
  const router = useRouter()
  const { country } = useLocalization()
  const isUnitedStates = String(country) === 'US'
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || ''
  const versionId = searchParams.get('versionId') || ''
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedAudio, setUploadedAudio] = useState<any>(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const returnUrl = `/compositores/admin/studio-ia/playback?projectId=${encodeURIComponent(projectId)}&versionId=${encodeURIComponent(versionId)}`
    if (!token) {
      router.replace(`/compositores/login?redirect=${encodeURIComponent(returnUrl)}`)
      return
    }
    if (!projectId || !versionId) {
      setLoading(false)
      return
    }

    void (async () => {
      try {
        const response = await fetch(`/api/compositores/studio/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || (isUnitedStates ? 'Could not load the song.' : 'Erro ao carregar a música.'))
        const exists = (data.project?.versions || []).some((item: any) => item.id === versionId)
        if (!exists) throw new Error(isUnitedStates ? 'This version does not belong to the selected project.' : 'Essa versão não pertence ao projeto escolhido.')
        setProject(data.project)

        const savedResponse = await fetch(`/api/compositores/studio/playback?projectId=${encodeURIComponent(projectId)}&versionId=${encodeURIComponent(versionId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const savedData = await savedResponse.json().catch(() => null)
        if (savedResponse.ok && savedData?.saved && savedData?.playbackUrl && savedData?.vocalUrl) {
          setResult(savedData)
        }
      } catch (loadError: any) {
        setError(loadError?.message || (isUnitedStates ? 'Could not load the song.' : 'Erro ao carregar a música.'))
      } finally {
        setLoading(false)
      }
    })()
  }, [isUnitedStates, projectId, router, versionId])

  const version = useMemo(
    () => (project?.versions || []).find((item: any) => item.id === versionId) || null,
    [project, versionId]
  )
  const versionNumber = version ? (project?.versions || []).length - (project?.versions || []).findIndex((item: any) => item.id === version.id) : 0

  const uploadFile = async (file: File) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return
    if (!file.type.startsWith('audio/')) {
      setError(isUnitedStates ? 'Choose a valid audio file.' : 'Escolha um arquivo de áudio válido.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(isUnitedStates ? 'The audio file must be no larger than 10 MB.' : 'O áudio precisa ter no máximo 10 MB.')
      return
    }

    setUploading(true)
    setError('')
    setResult(null)
    try {
      const prepareResponse = await fetch('/api/compositores/studio/input-upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type || 'audio/mpeg',
          sizeBytes: file.size,
          fileName: file.name,
          kind: 'enhance-source',
        }),
      })
      const prepareData = await prepareResponse.json()
      if (!prepareResponse.ok) throw new Error(prepareData.error || (isUnitedStates ? 'Could not prepare the upload.' : 'Não foi possível preparar o envio.'))

      const upload = prepareData.upload
      const putResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': upload.contentType || file.type || 'audio/mpeg' },
        body: file,
      })
      if (!putResponse.ok) throw new Error(isUnitedStates ? 'Audio upload failed. Please try again.' : 'Falha ao enviar o áudio. Tente novamente.')
      setUploadedAudio(upload)
      setUploadedFileName(file.name)
    } catch (uploadError: any) {
      setError(uploadError?.message || (isUnitedStates ? 'Could not upload the song.' : 'Erro ao enviar a música.'))
    } finally {
      setUploading(false)
    }
  }

  const createPlayback = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) return
    setProcessing(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/compositores/studio/playback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(projectId && versionId
          ? { projectId, versionId }
          : { upload: uploadedAudio, title: uploadedFileName.replace(/\.[^.]+$/, '') }),
      })
      const data = await response.json()
      if (!response.ok) {
        const refund = Number(data.creditsRefunded) > 0
          ? (isUnitedStates ? ' Your 10 credits were refunded.' : ' Seus 10 créditos foram devolvidos.')
          : ''
        throw new Error((data.error || (isUnitedStates ? 'Could not create the instrumental.' : 'Não foi possível criar o playback.')) + refund)
      }
      setResult(data)
      window.dispatchEvent(new Event('studioBalanceChange'))
    } catch (createError: any) {
      setError(createError?.message || (isUnitedStates ? 'Could not create the instrumental.' : 'Não foi possível criar o playback.'))
      window.dispatchEvent(new Event('studioBalanceChange'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-cyan-950/20 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href={projectId ? `/compositores/admin/studio-ia/projetos/${projectId}` : '/studio-ia'} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white">
          <FiArrowLeft /> {projectId ? (isUnitedStates ? 'Back to project' : 'Voltar ao projeto') : (isUnitedStates ? 'Back to AI Studio' : 'Voltar ao Studio IA')}
        </Link>

        <section className="overflow-hidden rounded-3xl border border-cyan-400/25 bg-gray-950/90 shadow-2xl shadow-cyan-950/30">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-950/70 via-primary-950/60 to-purple-950/60 p-6 sm:p-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200"><FiHeadphones className="h-7 w-7" /></div>
            <h1 className="text-3xl font-black sm:text-4xl">{isUnitedStates ? 'Create Instrumental' : 'Criar Playback'}</h1>
            <p className="mt-2 text-sm text-gray-300">{isUnitedStates ? 'Remove the lead vocal and receive the instrumental and isolated vocal tracks to listen to or download anytime.' : 'Retire a voz principal e receba o instrumental e a voz isolada para ouvir e baixar quando quiser.'}</p>
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-5 text-gray-300"><FiLoader className="animate-spin" /> {isUnitedStates ? 'Loading the selected version...' : 'Carregando a versão escolhida...'}</div>
            ) : project && version ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-300">{isUnitedStates ? 'Selected version' : 'Versão escolhida'}</p>
                  <h2 className="mt-1 text-xl font-black">{project.title || (isUnitedStates ? 'My song' : 'Minha música')}</h2>
                  <p className="mt-1 text-sm text-gray-400">{isUnitedStates ? 'Version' : 'Versão'} {versionNumber}{version.versionName ? ` · ${version.versionName}` : ''}</p>
                  {(version.audioUrl || version.streamAudioUrl) && <audio className="mt-4 w-full" controls src={version.audioUrl || version.streamAudioUrl} />}
                </div>

                {!result && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5">
                    <p className="font-black text-amber-100">{isUnitedStates ? 'Cost' : 'Custo'}: {PLAYBACK_CREDITS} {isUnitedStates ? 'credits' : 'créditos'}</p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-100/75">{isUnitedStates ? 'The cost is the same as creating a song. When finished, the instrumental and isolated vocal will be saved to this project. If processing cannot be completed, your credits will be refunded automatically.' : 'O valor é o mesmo da criação de uma música. Depois de concluído, o playback e a voz ficam salvos neste projeto. Se não for possível concluir, os créditos serão estornados automaticamente.'}</p>
                  </div>
                )}

                {!result && <button type="button" onClick={createPlayback} disabled={processing} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-primary-600 to-purple-600 px-6 py-4 text-lg font-black shadow-xl transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70">
                  {processing ? <><FiLoader className="animate-spin" /> {isUnitedStates ? 'Removing vocals...' : 'Retirando a voz...'}</> : <><FiHeadphones /> {isUnitedStates ? 'Create instrumental for 10 credits' : 'Criar playback por 10 créditos'}</>}
                </button>}
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || processing}
                    className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-950/20 p-5 text-center transition hover:border-cyan-300 hover:bg-cyan-950/35 disabled:opacity-60"
                  >
                    {uploading ? <FiLoader className="mb-3 h-8 w-8 animate-spin text-cyan-300" /> : <FiUploadCloud className="mb-3 h-8 w-8 text-cyan-300" />}
                    <span className="font-black">{isUnitedStates ? 'Upload my song' : 'Enviar minha música'}</span>
                    <span className="mt-1 text-xs text-gray-400">{isUnitedStates ? 'MP3, WAV, M4A, or another audio format · up to 10 MB' : 'MP3, WAV, M4A ou outro áudio · até 10 MB'}</span>
                  </button>
                  <Link
                    href="/compositores/admin/studio-ia/projetos?acao=playback"
                    className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-purple-400/35 bg-purple-950/20 p-5 text-center transition hover:border-purple-300 hover:bg-purple-950/35"
                  >
                    <FiFolder className="mb-3 h-8 w-8 text-purple-300" />
                    <span className="font-black">{isUnitedStates ? 'Choose a DCC song' : 'Escolher música do DCC'}</span>
                    <span className="mt-1 text-xs text-gray-400">{isUnitedStates ? 'Select a version you already created' : 'Selecione uma versão já produzida'}</span>
                  </Link>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadFile(file)
                    event.target.value = ''
                  }}
                />

                {uploadedAudio && (
                  <div className="rounded-2xl border border-green-400/30 bg-green-950/20 p-5">
                    <div className="flex items-center gap-3">
                      <FiMusic className="h-6 w-6 text-green-300" />
                      <div className="min-w-0">
                        <p className="font-black text-green-100">{isUnitedStates ? 'Song uploaded' : 'Música enviada'}</p>
                        <p className="truncate text-sm text-green-100/70">{uploadedFileName}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5">
                  <p className="font-black text-amber-100">{isUnitedStates ? 'Cost' : 'Custo'}: {PLAYBACK_CREDITS} {isUnitedStates ? 'credits' : 'créditos'}</p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-100/75">{isUnitedStates ? 'Credits are charged only when you start. If processing cannot be completed, they will be refunded automatically.' : 'Os créditos só serão debitados quando você iniciar. Se não for possível concluir, o valor será estornado automaticamente.'}</p>
                </div>

                {!result && (
                  <button type="button" onClick={createPlayback} disabled={processing || uploading || !uploadedAudio} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-primary-600 to-purple-600 px-6 py-4 text-lg font-black shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                    {processing ? <><FiLoader className="animate-spin" /> {isUnitedStates ? 'Removing vocals...' : 'Retirando a voz...'}</> : <><FiHeadphones /> {isUnitedStates ? 'Create instrumental for 10 credits' : 'Criar playback por 10 créditos'}</>}
                  </button>
                )}
              </>
            )}

            {processing && <p className="text-center text-sm text-gray-400">{isUnitedStates ? 'This may take a few minutes. Keep this page open.' : 'Isso pode levar alguns minutos. Mantenha esta página aberta.'}</p>}
            {error && <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">{error}</div>}
            {result?.playbackUrl && (
              <div className="rounded-2xl border border-green-400/35 bg-green-950/20 p-5">
                <div className="flex items-center gap-2 text-lg font-black text-green-200"><FiCheckCircle /> {result.saved ? (isUnitedStates ? 'Files saved to the project' : 'Arquivos salvos no projeto') : (isUnitedStates ? 'Separation complete!' : 'Separação concluída!')}</div>
                <p className="mt-1 text-sm text-green-100/70">{result.saved ? (isUnitedStates ? 'Your instrumental and isolated vocal are available here to listen to or download again anytime.' : 'Seu playback e a voz isolada ficam disponíveis aqui para você ouvir e baixar novamente quando quiser.') : (isUnitedStates ? 'Your instrumental and isolated vocal are ready.' : 'Seu playback e a voz isolada estão prontos.')}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-400/25 bg-black/30 p-4">
                    <p className="font-black text-cyan-200">{isUnitedStates ? 'Instrumental' : 'Playback / instrumental'}</p>
                    <audio className="mt-3 w-full" controls src={result.playbackUrl} />
                    <a href={result.playbackUrl} download={`${project?.title || uploadedFileName.replace(/\.[^.]+$/, '') || 'song'} - Instrumental.mp3`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-black text-white hover:bg-cyan-500"><FiDownload /> {isUnitedStates ? 'Download instrumental' : 'Baixar playback'}</a>
                  </div>
                  <div className="rounded-2xl border border-purple-400/25 bg-black/30 p-4">
                    <p className="font-black text-purple-200">{isUnitedStates ? 'Isolated vocal' : 'Voz isolada'}</p>
                    {result.vocalUrl ? (
                      <>
                        <audio className="mt-3 w-full" controls src={result.vocalUrl} />
                        <a href={result.vocalUrl} download={`${project?.title || uploadedFileName.replace(/\.[^.]+$/, '') || 'song'} - Vocal.mp3`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-black text-white hover:bg-purple-500"><FiDownload /> {isUnitedStates ? 'Download vocal' : 'Baixar voz'}</a>
                      </>
                    ) : (
                      <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm text-gray-400">{isUnitedStates ? 'The provider completed the instrumental but did not return a separate vocal track.' : 'O provedor concluiu o playback, mas não disponibilizou a voz separada.'}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button type="button" onClick={() => setResult(null)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-bold hover:bg-white/5"><FiRefreshCw /> {isUnitedStates ? 'Create another separation' : 'Criar uma nova separação'}</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function PlaybackPage() {
  const { country } = useLocalization()
  const isUnitedStates = String(country) === 'US'
  return <Suspense fallback={<main className="min-h-screen bg-black p-8 text-white">{isUnitedStates ? 'Loading...' : 'Carregando...'}</main>}><PlaybackCreator /></Suspense>
}
