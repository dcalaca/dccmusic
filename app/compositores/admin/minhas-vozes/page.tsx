'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiCheckCircle, FiLoader, FiMic, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi'

const statusLabels: Record<string, string> = {
  source_uploaded: 'Áudio recebido',
  validation_processing: 'Gerando frase de verificação',
  awaiting_verification: 'Aguardando gravação da frase',
  voice_processing: 'Criando voz clonada',
  ready: 'Pronta para usar',
  failed: 'Falhou',
}

const MAX_VOICE_AUDIO_BYTES = 50 * 1024 * 1024
const VALIDATION_PHRASE_EXPIRES_SECONDS = 10 * 60

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getValidationSecondsRemaining(voice: any, nowMs: number) {
  const startedAt = new Date(voice.updatedAt || voice.createdAt || Date.now()).getTime()
  if (!Number.isFinite(startedAt)) return VALIDATION_PHRASE_EXPIRES_SECONDS
  const elapsedSeconds = Math.floor((nowMs - startedAt) / 1000)
  return VALIDATION_PHRASE_EXPIRES_SECONDS - elapsedSeconds
}

async function readResponseJson(response: Response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    if (text.startsWith('Request En')) {
      return { error: 'O arquivo é grande demais para envio direto. Tente novamente; o sistema usará upload otimizado.' }
    }
    return { error: text.slice(0, 240) }
  }
}

async function uploadVoiceFileDirectly(token: string, file: File, kind: 'source' | 'verify') {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Envie um arquivo de áudio.')
  }

  if (file.size > MAX_VOICE_AUDIO_BYTES) {
    throw new Error(`O áudio da voz precisa ter no máximo ${formatFileSize(MAX_VOICE_AUDIO_BYTES)}.`)
  }

  const prepareResponse = await fetch('/api/compositores/studio/voices/upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType: file.type || 'audio/mpeg',
      sizeBytes: file.size,
      kind,
    }),
  })
  const prepareData = await readResponseJson(prepareResponse)
  if (!prepareResponse.ok) throw new Error(prepareData.error || 'Erro ao preparar upload do áudio')

  const upload = prepareData.upload
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': upload.contentType,
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error('Não foi possível enviar o áudio para o armazenamento. Se persistir, avise para configurarmos CORS do R2.')
  }

  return {
    path: upload.path,
    provider: upload.provider,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
  }
}

export default function ComposerVoicesPage() {
  const router = useRouter()
  const [voices, setVoices] = useState<any[]>([])
  const [limit, setLimit] = useState(5)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshingId, setRefreshingId] = useState('')
  const [verifyingId, setVerifyingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [recordingVoiceId, setRecordingVoiceId] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sourceRecording, setSourceRecording] = useState(false)
  const [sourceRecordingSeconds, setSourceRecordingSeconds] = useState(0)
  const [sourceRecordedFile, setSourceRecordedFile] = useState<File | null>(null)
  const [sourceRecordedUrl, setSourceRecordedUrl] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sourceMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const sourceRecordingStreamRef = useRef<MediaStream | null>(null)
  const sourceRecordingChunksRef = useRef<Blob[]>([])
  const sourceRecordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sourceSubmittingRef = useRef(false)

  const loadVoices = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/minhas-vozes')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/compositores/studio/voices', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        router.push('/compositores/login?redirect=/compositores/admin/minhas-vozes')
        return
      }
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar vozes')
      setVoices(data.voices || [])
      setLimit(data.limit || 5)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar vozes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVoices()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current)
      if (sourceRecordingIntervalRef.current) window.clearInterval(sourceRecordingIntervalRef.current)
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      sourceRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (sourceRecordedUrl) URL.revokeObjectURL(sourceRecordedUrl)
    }
  }, [sourceRecordedUrl])

  const uploadSourceVoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sourceSubmittingRef.current) return

    const token = localStorage.getItem('composer_token')
    if (!token) return

    sourceSubmittingRef.current = true
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('consent', formData.get('consent') === 'on' ? 'true' : 'false')

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const selectedAudioFile = formData.get('audio')
      const audioFile = selectedAudioFile instanceof File && selectedAudioFile.size > 0
        ? selectedAudioFile
        : sourceRecordedFile
      if (!(audioFile instanceof File) || audioFile.size === 0) {
        throw new Error('Escolha um áudio pronto ou grave a voz base pelo microfone.')
      }

      const uploadedAsset = await uploadVoiceFileDirectly(token, audioFile, 'source')
      const response = await fetch('/api/compositores/studio/voices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: formData.get('displayName'),
          consent: formData.get('consent') === 'true',
          vocalStartS: formData.get('vocalStartS'),
          vocalEndS: formData.get('vocalEndS'),
          uploadedAsset,
        }),
      })
      const data = await readResponseJson(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar voz')
      form.reset()
      setSourceRecordedFile(null)
      if (sourceRecordedUrl) URL.revokeObjectURL(sourceRecordedUrl)
      setSourceRecordedUrl('')
      setMessage('Voz enviada. Agora aguarde a frase de verificação da nossa IA.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar voz')
    } finally {
      sourceSubmittingRef.current = false
      setSubmitting(false)
    }
  }

  const refreshVoice = async (voiceId: string) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    setRefreshingId(voiceId)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'refresh' }),
      })
      const data = await readResponseJson(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar voz')
      setMessage('Status atualizado.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar voz')
    } finally {
      setRefreshingId('')
    }
  }

  const regenerateValidationPhrase = async (voiceId: string) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    setRefreshingId(voiceId)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate-validation' }),
      })
      const data = await readResponseJson(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar nova frase')
      setMessage('Nova frase solicitada. Aguarde alguns segundos e clique em Atualizar status.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar nova frase')
    } finally {
      setRefreshingId('')
    }
  }

  const reactivateExpiredVoice = async (voiceId: string) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    setRefreshingId(voiceId)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reactivate-expired' }),
      })
      const data = await readResponseJson(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao reativar voz')
      setMessage('Reativação iniciada sem cobrança. Aguarde alguns segundos e clique em Atualizar status. Se aparecer uma nova frase, grave a frase para recriar a voz.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao reativar voz')
    } finally {
      setRefreshingId('')
    }
  }

  const submitVerificationFile = async (voiceId: string, audioFile: File, form?: HTMLFormElement) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    setVerifyingId(voiceId)
    setError('')
    setMessage('')
    try {
      const uploadedAsset = await uploadVoiceFileDirectly(token, audioFile, 'verify')
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadedAsset }),
      })
      const data = await readResponseJson(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar verificação')
      form?.reset()
      setMessage('Verificação enviada. Nossa IA está criando a voz clonada.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar verificação')
    } finally {
      setVerifyingId('')
    }
  }

  const uploadVerification = async (event: FormEvent<HTMLFormElement>, voiceId: string) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const audioFile = formData.get('audio')

    if (!(audioFile instanceof File) || audioFile.size === 0) {
      setError('Envie a gravação da frase de verificação.')
      return
    }

    await submitVerificationFile(voiceId, audioFile, form)
  }

  const startRecordingVerification = async (voiceId: string) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não permite gravação direta. Use a opção de escolher arquivo.')
      return
    }

    try {
      setError('')
      setMessage('')
      recordingChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      recordingStreamRef.current = stream
      mediaRecorderRef.current = recorder
      setRecordingVoiceId(voiceId)
      setRecordingSeconds(0)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm'
        const blob = new Blob(recordingChunksRef.current, { type })
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
        mediaRecorderRef.current = null
        recordingChunksRef.current = []
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }
        setRecordingVoiceId('')
        setRecordingSeconds(0)

        if (!blob.size) {
          setError('Não conseguimos capturar o áudio. Tente gravar novamente.')
          return
        }

        const file = new File([blob], `frase-verificacao.${extension}`, { type })
        await submitVerificationFile(voiceId, file)
      }

      recorder.start()
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1)
      }, 1000)
    } catch {
      setRecordingVoiceId('')
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      setError('Não foi possível acessar o microfone. Autorize o microfone no navegador ou use a opção de escolher arquivo.')
    }
  }

  const stopRecordingVerification = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const startRecordingSource = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não permite gravação direta. Use a opção de escolher arquivo.')
      return
    }

    try {
      setError('')
      setMessage('')
      sourceRecordingChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      sourceRecordingStreamRef.current = stream
      sourceMediaRecorderRef.current = recorder
      setSourceRecording(true)
      setSourceRecordingSeconds(0)
      setSourceRecordedFile(null)
      if (sourceRecordedUrl) URL.revokeObjectURL(sourceRecordedUrl)
      setSourceRecordedUrl('')

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) sourceRecordingChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm'
        const blob = new Blob(sourceRecordingChunksRef.current, { type })
        sourceRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        sourceRecordingStreamRef.current = null
        sourceMediaRecorderRef.current = null
        sourceRecordingChunksRef.current = []
        if (sourceRecordingIntervalRef.current) {
          window.clearInterval(sourceRecordingIntervalRef.current)
          sourceRecordingIntervalRef.current = null
        }
        setSourceRecording(false)
        setSourceRecordingSeconds(0)

        if (!blob.size) {
          setError('Não conseguimos capturar o áudio. Tente gravar novamente.')
          return
        }

        const file = new File([blob], `voz-base.${extension}`, { type })
        setSourceRecordedFile(file)
        setSourceRecordedUrl(URL.createObjectURL(blob))
        setMessage('Gravação da voz base pronta. Confira o áudio e clique em Enviar voz.')
      }

      recorder.start()
      sourceRecordingIntervalRef.current = setInterval(() => {
        setSourceRecordingSeconds((seconds) => seconds + 1)
      }, 1000)
    } catch {
      setSourceRecording(false)
      sourceRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      sourceRecordingStreamRef.current = null
      setError('Não foi possível acessar o microfone. Autorize o microfone no navegador ou use a opção de escolher arquivo.')
    }
  }

  const stopRecordingSource = () => {
    if (sourceMediaRecorderRef.current?.state === 'recording') {
      sourceMediaRecorderRef.current.stop()
    }
  }

  const clearSourceRecording = () => {
    setSourceRecordedFile(null)
    if (sourceRecordedUrl) URL.revokeObjectURL(sourceRecordedUrl)
    setSourceRecordedUrl('')
  }

  const deleteVoice = async (voiceId: string) => {
    if (!window.confirm('Excluir esta voz? Ela deixará de aparecer na sua lista e abrirá espaço para cadastrar outra.')) return
    const token = localStorage.getItem('composer_token')
    if (!token) return

    setDeletingId(voiceId)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao apagar voz')
      setMessage('Voz excluída. Agora você pode cadastrar outra voz se quiser.')
      await loadVoices()
    } catch (err: any) {
      setError(err.message || 'Erro ao apagar voz')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/compositores/admin/meus-dados" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar para meus dados
          </Link>

          <div className="mb-8 rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                  <FiMic /> Voz IA
                </div>
                <h1 className="text-3xl font-black sm:text-4xl">
                  <span className="gradient-text">Minhas vozes</span>
                </h1>
                <p className="mt-2 max-w-2xl text-gray-300">
                  Cadastre até {limit} vozes. Envie preferencialmente um áudio limpo da sua voz, sem instrumentos. Depois grave a frase de verificação solicitada pela nossa IA.
                </p>
                <p className="mt-3 max-w-2xl text-sm font-semibold text-purple-100">
                  A criação da voz só desconta 2 créditos se ela ficar pronta para uso. Tentativas que falharem não são cobradas.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-300">
                <p className="font-bold text-white">{voices.length}/{limit} vozes cadastradas</p>
                <p className="mt-1 text-gray-400">Use apenas vozes suas ou autorizadas.</p>
              </div>
            </div>
          </div>

          {message && <div className="mb-6 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <section className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-black">Cadastrar nova voz</h2>
            <div className="mb-5">
              <div className="rounded-2xl border border-green-800/60 bg-green-950/20 p-4">
                <p className="font-black text-green-100">Melhor opção: áudio limpo da voz</p>
                <p className="mt-2 text-sm text-green-50/80">
                  Use um áudio com a voz clara, sem instrumentos, sem backing vocal e com pouco efeito. Assim a clonagem fica mais parecida.
                </p>
                <p className="mt-2 text-xs font-bold text-green-100">
                  Custo: 2 créditos somente quando a voz for aprovada e ficar pronta.
                </p>
              </div>
            </div>
            <form onSubmit={uploadSourceVoice} className="grid gap-4 lg:grid-cols-[1fr_160px_160px]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Nome da voz</span>
                <input name="displayName" required maxLength={60} placeholder="Ex.: Minha voz sertanejo" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Início vocal (s)</span>
                <input name="vocalStartS" type="number" min={0} defaultValue={0} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Fim vocal (s)</span>
                <input name="vocalEndS" type="number" min={1} defaultValue={20} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <div className="grid gap-4 lg:col-span-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
                  <p className="text-sm font-bold text-purple-100">Opção 1: gravar a voz agora</p>
                  <p className="mt-1 text-xs text-purple-100/80">
                    Ideal no celular: grave 10 a 20 segundos de voz limpa, sem música no fundo.
                  </p>
                  {sourceRecording ? (
                    <button type="button" onClick={stopRecordingSource} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-600">
                      <FiMic /> Parar gravação ({sourceRecordingSeconds}s)
                    </button>
                  ) : (
                    <button type="button" onClick={startRecordingSource} disabled={Boolean(recordingVoiceId) || submitting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                      <FiMic /> Gravar voz base
                    </button>
                  )}
                  {sourceRecordedUrl && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase text-purple-100/80">Gravação pronta</p>
                      <audio controls src={sourceRecordedUrl} className="w-full" />
                      <button type="button" onClick={clearSourceRecording} className="mt-2 text-xs font-bold text-red-200 hover:text-red-100">
                        Descartar gravação
                      </button>
                    </div>
                  )}
                </div>
                <label className="block rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Opção 2: escolher áudio pronto</span>
                  <input name="audio" type="file" accept="audio/*" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white" />
                  <span className="mt-2 block text-xs text-gray-400">
                    Dica: se o arquivo for uma música pronta com instrumental, a IA pode não conseguir copiar só a voz com qualidade.
                  </span>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-300 lg:col-span-3">
                <input name="consent" type="checkbox" required className="mt-1" />
                Confirmo que essa voz é minha ou tenho autorização explícita para usar essa voz em músicas geradas por IA.
              </label>
              {voices.length >= limit && (
                <div className="rounded-2xl border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-100 lg:col-span-3">
                  Você chegou ao limite de {limit} vozes. Exclua uma voz cadastrada abaixo para liberar espaço e enviar outra.
                </div>
              )}
              <button type="submit" disabled={submitting || voices.length >= limit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white disabled:opacity-60 lg:col-span-3">
                {submitting ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
                {voices.length >= limit ? 'Limite de 5 vozes atingido' : 'Enviar voz'}
              </button>
            </form>
          </section>

          {loading ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">Carregando vozes...</div>
          ) : voices.length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">Nenhuma voz cadastrada ainda.</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {voices.map((voice) => (
                <article key={voice.id} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-white">{voice.displayName}</h3>
                      <p className="mt-1 text-sm text-gray-400">{statusLabels[voice.status] || voice.status}</p>
                    </div>
                    {voice.status === 'ready' && <FiCheckCircle className="h-6 w-6 text-green-300" />}
                  </div>

                  {voice.sourceAudioUrl && <audio controls src={voice.sourceAudioUrl} className="mb-4 w-full" />}
                  {voice.errorMessage && <p className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{voice.errorMessage}</p>}

                  {voice.validateInfo && (
                    <div className="mb-4 rounded-2xl border border-primary-800 bg-primary-950/30 p-4">
                      <p className="text-xs font-bold uppercase text-primary-200">Frase para gravar</p>
                      <p className="mt-2 text-lg font-black text-white">{voice.validateInfo}</p>
                      <p className="mt-2 text-sm text-gray-300">Grave você cantando ou falando exatamente essa frase e envie abaixo.</p>
                      {(() => {
                        const secondsRemaining = getValidationSecondsRemaining(voice, nowMs)
                        const expired = secondsRemaining <= 0
                        return (
                          <div className={`mt-3 rounded-xl border p-3 text-sm ${expired ? 'border-yellow-700 bg-yellow-950/30 text-yellow-100' : 'border-purple-700/60 bg-black/30 text-purple-100'}`}>
                            {expired ? (
                              <>
                                <p className="font-bold">Essa frase pode ter expirado.</p>
                                <button type="button" onClick={() => regenerateValidationPhrase(voice.id)} disabled={refreshingId === voice.id} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-700 px-3 py-2 font-bold text-white disabled:opacity-60">
                                  {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />} Gerar nova frase
                                </button>
                              </>
                            ) : (
                              <p><strong>Tempo recomendado para enviar:</strong> {formatCountdown(secondsRemaining)}</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {voice.status === 'awaiting_verification' && (
                    <form onSubmit={(event) => uploadVerification(event, voice.id)} className="mb-4 space-y-3">
                      <div className="rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
                        <p className="text-sm font-bold text-purple-100">Grave a frase direto por aqui</p>
                        <p className="mt-1 text-xs text-purple-100/80">Clique em gravar, fale ou cante a frase acima e depois pare para enviar automaticamente.</p>
                        {recordingVoiceId === voice.id ? (
                          <button type="button" onClick={stopRecordingVerification} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-600">
                            <FiMic /> Parar e enviar ({recordingSeconds}s)
                          </button>
                        ) : (
                          <button type="button" onClick={() => startRecordingVerification(voice.id)} disabled={Boolean(recordingVoiceId) || verifyingId === voice.id} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                            <FiMic /> Gravar frase agora
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">Ou envie um arquivo pronto</p>
                        <input name="audio" type="file" accept="audio/*" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white" />
                      </div>
                      <button disabled={verifyingId === voice.id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                        {verifyingId === voice.id ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
                        Enviar arquivo da frase
                      </button>
                    </form>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {voice.status === 'failed' && voice.sourceAudioUrl && voice.verifyAudioUrl && String(voice.errorMessage || '').toLowerCase().includes('expir') && (
                      <button onClick={() => reactivateExpiredVoice(voice.id)} disabled={refreshingId === voice.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                        {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        Reativar voz sem cobrança
                      </button>
                    )}
                    {voice.status === 'ready' && voice.sourceAudioUrl && voice.verifyAudioUrl && (
                      <button onClick={() => reactivateExpiredVoice(voice.id)} disabled={refreshingId === voice.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-purple-700 bg-purple-950/30 px-4 py-3 font-bold text-purple-100 hover:bg-purple-950/60 disabled:opacity-60">
                        {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        Recriar voz sem cobrança
                      </button>
                    )}
                    {voice.status !== 'ready' && (
                      <button onClick={() => refreshVoice(voice.id)} disabled={refreshingId === voice.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-black/30 px-4 py-3 font-bold text-gray-100 hover:bg-gray-900 disabled:opacity-60">
                        {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        Atualizar status
                      </button>
                    )}
                    <button onClick={() => deleteVoice(voice.id)} disabled={deletingId === voice.id} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 font-bold text-red-100 hover:bg-red-950/60 disabled:opacity-60">
                      {deletingId === voice.id ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                      Excluir voz
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
