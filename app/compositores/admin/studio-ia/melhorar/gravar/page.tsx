'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiCheckCircle, FiEdit3, FiLoader, FiMic, FiMusic, FiPause, FiPlay, FiRefreshCw, FiZap } from 'react-icons/fi'

const MAX_RECORDING_MS = 4.5 * 60 * 1000

async function readApiResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 240) }
  }
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export default function RecordMusicPage() {
  const router = useRouter()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioUrlRef = useRef('')
  const recordingTimeoutRef = useRef<number | null>(null)

  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState('')
  const [notes, setNotes] = useState('')
  const [lyric, setLyric] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<'transcribing' | 'completing' | 'creating' | ''>('')

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const ensureLoggedIn = () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/melhorar/gravar')
      return null
    }
    return token
  }

  const startRecording = async () => {
    setError('')
    setMessage('')
    if (!ensureLoggedIn()) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Seu navegador não liberou o gravador. Tente pelo Chrome no celular ou computador.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        const nextAudioUrl = URL.createObjectURL(blob)
        audioUrlRef.current = nextAudioUrl
        setAudioBlob(blob)
        setAudioUrl(nextAudioUrl)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      recorder.start()
      setRecording(true)
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop()
          setRecording(false)
          setMessage('A gravação parou automaticamente no limite de 4 minutos e 30 segundos.')
        }
      }, MAX_RECORDING_MS)
    } catch {
      setError('Não consegui acessar o microfone. Veja se o navegador pediu permissão e tente novamente.')
    }
  }

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    recorderRef.current?.stop()
    setRecording(false)
  }

  const resetRecording = () => {
    if (recording) stopRecording()
    setAudioBlob(null)
    setLyric('')
    setMessage('')
    setError('')
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = ''
    setAudioUrl('')
  }

  const createAudioFile = () => {
    if (!audioBlob) return null
    const extension = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
    return new File([audioBlob], `gravacao-dcc-music.${extension}`, { type: audioBlob.type || 'audio/webm' })
  }

  const transcribeAudio = async () => {
    const token = ensureLoggedIn()
    if (!token) return
    const audioFile = createAudioFile()
    if (!audioFile) {
      setError('Grave um áudio antes de transcrever.')
      return
    }

    setBusy('transcribing')
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.set('audio', audioFile)
      const response = await fetch('/api/compositores/studio/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Não consegui entender o áudio.')
      setLyric(data.text || '')
      setMessage('Letra transcrita. Revise e corrija se precisar.')
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever áudio.')
    } finally {
      setBusy('')
    }
  }

  const completeLyric = async () => {
    const token = ensureLoggedIn()
    if (!token) return
    if (lyric.trim().length < 10) {
      setError('Transcreva ou escreva um trecho antes de pedir para completar.')
      return
    }

    setBusy('completing')
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/compositores/studio/recording-lyric', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, style, lyric, notes }),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Não consegui completar a letra.')
      setLyric(data.lyric || lyric)
      setMessage('Completei a letra. Revise antes de produzir a música.')
    } catch (err: any) {
      setError(err.message || 'Erro ao completar letra.')
    } finally {
      setBusy('')
    }
  }

  const createMusic = async (mode: 'complete' | 'ready') => {
    const token = ensureLoggedIn()
    if (!token) return
    const audioFile = createAudioFile()
    if (!audioFile) {
      setError('Grave um áudio antes de criar a música.')
      return
    }
    if (!title.trim()) {
      setError('Informe o nome da música.')
      return
    }
    if (lyric.trim().length < 40) {
      setError('Revise a letra e deixe pelo menos um trecho maior antes de criar a música.')
      return
    }

    setBusy('creating')
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.set('title', title.trim())
      formData.set('style', style.trim())
      formData.set('audio', audioFile)
      formData.set('lyric', lyric.trim())
      formData.set('improvement', mode === 'complete' ? 'professional' : 'similar')

      const response = await fetch('/api/compositores/studio/enhance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao criar música.')

      window.dispatchEvent(new Event('studioBalanceChange'))
      setMessage('Produção iniciada. Vamos abrir o projeto para você acompanhar.')
      window.setTimeout(() => {
        router.push(`/compositores/admin/studio-ia/projetos/${data.projectId}`)
      }, 900)
    } catch (err: any) {
      setError(err.message || 'Erro ao criar música.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="min-h-screen py-5 sm:py-7">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/compositores/admin/studio-ia/melhorar" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-300 transition hover:text-primary-200">
            <FiArrowLeft /> Voltar
          </Link>

          <section className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.28),transparent_34%),linear-gradient(135deg,rgba(8,8,12,0.98),rgba(17,24,39,0.94),rgba(49,15,80,0.68))] p-4 shadow-2xl shadow-purple-950/25 sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100">
              <FiMic /> Gravar agora
            </div>
            <h1 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">
              Cante sua ideia e deixe a IA transformar em música
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
              Grave pelo microfone, confira a letra que a IA entendeu e escolha se quer completar a música ou produzir a versão final. A gravação para automaticamente em 4:30.
            </p>
          </section>

          {message && <div className="mb-4 rounded-2xl border border-green-800 bg-green-950/50 p-4 text-sm text-green-200">{message}</div>}
          {error && <div className="mb-4 rounded-2xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">{error}</div>}

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
              <h2 className="text-xl font-black text-white">1. Grave sua voz</h2>
              <p className="mt-1 text-sm text-gray-400">Pode cantar só um trecho ou a música inteira. Máximo: 4 minutos e 30 segundos.</p>

              <div className="mt-5 grid gap-3">
                {!recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-4 font-black text-white disabled:opacity-60"
                  >
                    <FiMic /> Começar gravação
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 py-4 font-black text-white"
                  >
                    <FiPause /> Parar gravação
                  </button>
                )}

                {audioUrl && (
                  <div className="rounded-2xl border border-purple-300/15 bg-black/30 p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100">
                      <FiPlay /> Ouça antes de continuar
                    </p>
                    <audio controls src={audioUrl} className="w-full" />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={transcribeAudio}
                        disabled={Boolean(busy)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {busy === 'transcribing' ? <FiLoader className="animate-spin" /> : <FiEdit3 />}
                        Entender letra
                      </button>
                      <button
                        type="button"
                        onClick={resetRecording}
                        disabled={Boolean(busy)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-gray-100 disabled:opacity-60"
                      >
                        <FiRefreshCw /> Gravar de novo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
              <h2 className="text-xl font-black text-white">2. Revise a letra</h2>
              <p className="mt-1 text-sm text-gray-400">A IA pode errar palavras cantadas. Corrija antes de produzir.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-bold text-gray-300">Nome da música</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={30} placeholder="Ex.: Chave Falsa" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-bold text-gray-300">Estilo desejado</span>
                  <input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Ex.: sertanejo, arrocha..." className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-bold text-gray-300">Letra que a IA entendeu</span>
                <textarea value={lyric} onChange={(event) => setLyric(event.target.value)} rows={10} placeholder="Depois de clicar em Entender letra, o texto aparece aqui. Você também pode escrever manualmente." className="w-full rounded-2xl border border-gray-700 bg-black/40 px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-primary-500" />
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-bold text-gray-300">Observação para a IA</span>
                <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: quero mais sofrida, refrão forte..." className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
            </section>
          </div>

          <section className="mt-4 rounded-[1.75rem] border border-purple-300/15 bg-gradient-to-br from-purple-950/30 via-gray-950 to-black p-4 sm:p-5">
            <h2 className="text-xl font-black text-white">3. Escolha o que fazer</h2>
            <p className="mt-1 text-sm text-gray-400">Use “completar” se cantou só uma parte. Use “já está pronta” se cantou a música inteira.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <button
                type="button"
                onClick={completeLyric}
                disabled={Boolean(busy)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 font-black text-white hover:bg-white/[0.09] disabled:opacity-60"
              >
                {busy === 'completing' ? <FiLoader className="animate-spin" /> : <FiEdit3 />}
                Completar minha música
              </button>
              <button
                type="button"
                onClick={() => createMusic('ready')}
                disabled={Boolean(busy)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-black text-white disabled:opacity-60"
              >
                {busy === 'creating' ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                Minha música já está pronta
              </button>
              <button
                type="button"
                onClick={() => createMusic('complete')}
                disabled={Boolean(busy)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-4 font-black text-white disabled:opacity-60"
              >
                {busy === 'creating' ? <FiLoader className="animate-spin" /> : <FiMusic />}
                Produzir com essa letra
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-purple-100/75">
              A produção usa a sua gravação como guia de melodia e interpretação. A IA recebe a instrução para não passar de 4:30. Custo: 10 créditos quando a música é iniciada.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
