'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiCheckCircle, FiLoader, FiMic, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi'

const statusLabelKeys: Record<string, string> = {
  source_uploaded: 'voices.status.sourceUploaded',
  validation_processing: 'voices.status.validationProcessing',
  awaiting_verification: 'voices.status.awaitingVerification',
  voice_processing: 'voices.status.voiceProcessing',
  ready: 'voices.status.ready',
  failed: 'voices.status.failed',
}

const MAX_VOICE_AUDIO_BYTES = 50 * 1024 * 1024
const VALIDATION_PHRASE_EXPIRES_SECONDS = 10 * 60

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function formatFileSize(bytes: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`
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

async function readResponseJson(response: Response, t: (key: string, options?: any) => string) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    if (text.startsWith('Request En')) {
      return { error: t('voices.errors.fileTooLargeDirect') }
    }
    return { error: text.slice(0, 240) }
  }
}

async function uploadVoiceFileDirectly(token: string, file: File, kind: 'source' | 'verify', t: (key: string, options?: any) => string, locale: string) {
  if (!file.type.startsWith('audio/')) {
    throw new Error(t('voices.errors.audioFileRequired'))
  }

  if (file.size > MAX_VOICE_AUDIO_BYTES) {
    throw new Error(t('voices.errors.maxFileSize', { size: formatFileSize(MAX_VOICE_AUDIO_BYTES, locale) }))
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
  const prepareData = await readResponseJson(prepareResponse, t)
  if (!prepareResponse.ok) throw new Error(prepareData.error || t('voices.errors.prepareUpload'))

  const upload = prepareData.upload
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': upload.contentType,
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error(t('voices.errors.storageUpload'))
  }

  return {
    path: upload.path,
    provider: upload.provider,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
  }
}

export default function ComposerVoicesPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [voices, setVoices] = useState<any[]>([])
  const [recoverableVoices, setRecoverableVoices] = useState<any[]>([])
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
  const pendingVerificationVoice = voices.find((voice) => voice.status === 'awaiting_verification')

  const loadVoices = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/minhas-vozes')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/compositores/studio/voices?includeRecoverable=true', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        router.push('/compositores/login?redirect=/compositores/admin/minhas-vozes')
        return
      }
      if (!response.ok) throw new Error(data.error || t('voices.errors.load'))
      setVoices(data.voices || [])
      setRecoverableVoices(data.recoverableVoices || [])
      setLimit(data.limit || 5)
    } catch (err: any) {
      setError(err.message || t('voices.errors.load'))
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
        throw new Error(t('voices.errors.chooseOrRecord'))
      }

      const uploadedAsset = await uploadVoiceFileDirectly(token, audioFile, 'source', t, i18n.language)
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
      const data = await readResponseJson(response, t)
      if (!response.ok) throw new Error(data.error || t('voices.errors.sendVoice'))
      form.reset()
      setSourceRecordedFile(null)
      if (sourceRecordedUrl) URL.revokeObjectURL(sourceRecordedUrl)
      setSourceRecordedUrl('')
      setMessage(t('voices.messages.voiceSent'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.sendVoice'))
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
      const data = await readResponseJson(response, t)
      if (!response.ok) throw new Error(data.error || t('voices.errors.refresh'))
      setMessage(t('voices.messages.statusUpdated'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.refresh'))
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
      const data = await readResponseJson(response, t)
      if (!response.ok) throw new Error(data.error || t('voices.errors.regeneratePhrase'))
      setMessage(t('voices.messages.newPhraseRequested'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.regeneratePhrase'))
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
      const data = await readResponseJson(response, t)
      if (!response.ok) throw new Error(data.error || t('voices.errors.reactivate'))
      setMessage(t('voices.messages.reactivationStarted'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.reactivate'))
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
      const uploadedAsset = await uploadVoiceFileDirectly(token, audioFile, 'verify', t, i18n.language)
      const response = await fetch(`/api/compositores/studio/voices/${voiceId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadedAsset }),
      })
      const data = await readResponseJson(response, t)
      if (!response.ok) throw new Error(data.error || t('voices.errors.sendVerification'))
      form?.reset()
      setMessage(t('voices.messages.verificationSent'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.sendVerification'))
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
      setError(t('voices.errors.verificationFileRequired'))
      return
    }

    await submitVerificationFile(voiceId, audioFile, form)
  }

  const startRecordingVerification = async (voiceId: string) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('voices.errors.recordingUnsupported'))
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
          setError(t('voices.errors.captureFailed'))
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
      setError(t('voices.errors.microphone'))
    }
  }

  const stopRecordingVerification = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const startRecordingSource = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('voices.errors.recordingUnsupported'))
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
          setError(t('voices.errors.captureFailed'))
          return
        }

        const file = new File([blob], `voz-base.${extension}`, { type })
        setSourceRecordedFile(file)
        setSourceRecordedUrl(URL.createObjectURL(blob))
        setMessage(t('voices.messages.baseRecordingReady'))
      }

      recorder.start()
      sourceRecordingIntervalRef.current = setInterval(() => {
        setSourceRecordingSeconds((seconds) => seconds + 1)
      }, 1000)
    } catch {
      setSourceRecording(false)
      sourceRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      sourceRecordingStreamRef.current = null
      setError(t('voices.errors.microphone'))
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
    if (!window.confirm(t('voices.confirmDelete'))) return
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
      if (!response.ok) throw new Error(data.error || t('voices.errors.delete'))
      setMessage(t('voices.messages.deleted'))
      await loadVoices()
    } catch (err: any) {
      setError(err.message || t('voices.errors.delete'))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/compositores/admin/meus-dados" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> {t('voices.backToProfile')}
          </Link>

          <div className="mb-8 rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                  <FiMic /> {t('voices.badge')}
                </div>
                <h1 className="text-3xl font-black sm:text-4xl">
                  <span className="gradient-text">{t('voices.title')}</span>
                </h1>
                <p className="mt-2 max-w-2xl text-gray-300">
                  {t('voices.subtitle', { count: limit })}
                </p>
                <p className="mt-3 max-w-2xl text-sm font-semibold text-purple-100">
                  {t('voices.billingHint')}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-300">
                <p className="font-bold text-white">{t('voices.registeredCount', { current: voices.length, count: limit })}</p>
                <p className="mt-1 text-gray-400">{t('voices.authorizedOnly')}</p>
              </div>
            </div>
          </div>

          {message && <div className="mb-6 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          {pendingVerificationVoice ? (
            <section className="mb-8 rounded-3xl border border-yellow-800/70 bg-yellow-950/20 p-5 sm:p-6">
              <h2 className="text-xl font-black text-yellow-100">{t('voices.pending.title')}</h2>
              <p className="mt-2 text-sm text-yellow-50/90">
                {t('voices.pending.description', { name: pendingVerificationVoice.displayName })}
              </p>
            </section>
          ) : (
          <section className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-black">{t('voices.newVoice.title')}</h2>
            <div className="mb-5">
              <div className="rounded-2xl border border-green-800/60 bg-green-950/20 p-4">
                <p className="font-black text-green-100">{t('voices.newVoice.bestOption')}</p>
                <p className="mt-2 text-sm text-green-50/80">
                  {t('voices.newVoice.bestOptionHint')}
                </p>
                <p className="mt-2 text-xs font-bold text-green-100">
                  {t('voices.newVoice.costHint')}
                </p>
              </div>
            </div>
            <form onSubmit={uploadSourceVoice} className="grid gap-4 lg:grid-cols-[1fr_160px_160px]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('voices.newVoice.name')}</span>
                <input name="displayName" required maxLength={60} placeholder={t('voices.newVoice.namePlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('voices.newVoice.vocalStart')}</span>
                <input name="vocalStartS" type="number" min={0} defaultValue={0} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('voices.newVoice.vocalEnd')}</span>
                <input name="vocalEndS" type="number" min={1} defaultValue={20} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <div className="grid gap-4 lg:col-span-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
                  <p className="text-sm font-bold text-purple-100">{t('voices.newVoice.recordOption')}</p>
                  <p className="mt-1 text-xs text-purple-100/80">
                    {t('voices.newVoice.recordHint')}
                  </p>
                  {sourceRecording ? (
                    <button type="button" onClick={stopRecordingSource} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-600">
                      <FiMic /> {t('voices.newVoice.stopRecording', { seconds: sourceRecordingSeconds })}
                    </button>
                  ) : (
                    <button type="button" onClick={startRecordingSource} disabled={Boolean(recordingVoiceId) || submitting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                      <FiMic /> {t('voices.newVoice.recordBase')}
                    </button>
                  )}
                  {sourceRecordedUrl && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase text-purple-100/80">{t('voices.newVoice.recordingReady')}</p>
                      <audio controls src={sourceRecordedUrl} className="w-full" />
                      <button type="button" onClick={clearSourceRecording} className="mt-2 text-xs font-bold text-red-200 hover:text-red-100">
                        {t('voices.newVoice.discardRecording')}
                      </button>
                    </div>
                  )}
                </div>
                <label className="block rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('voices.newVoice.fileOption')}</span>
                  <input name="audio" type="file" accept="audio/*" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white" />
                  <span className="mt-2 block text-xs text-gray-400">
                    {t('voices.newVoice.fileHint')}
                  </span>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-300 lg:col-span-3">
                <input name="consent" type="checkbox" required className="mt-1" />
                {t('voices.newVoice.consent')}
              </label>
              {voices.length >= limit && (
                <div className="rounded-2xl border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-100 lg:col-span-3">
                  {t('voices.newVoice.limitReachedHint', { count: limit })}
                </div>
              )}
              <button type="submit" disabled={submitting || voices.length >= limit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white disabled:opacity-60 lg:col-span-3">
                {submitting ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
                {voices.length >= limit ? t('voices.newVoice.limitReached', { count: limit }) : t('voices.newVoice.send')}
              </button>
            </form>
          </section>
          )}

          {loading ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">{t('voices.loading')}</div>
          ) : voices.length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">{t('voices.empty')}</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {voices.map((voice) => (
                <article key={voice.id} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-white">{voice.displayName}</h3>
                      <p className="mt-1 text-sm text-gray-400">{statusLabelKeys[voice.status] ? t(statusLabelKeys[voice.status]) : voice.status}</p>
                    </div>
                    {voice.status === 'ready' && <FiCheckCircle className="h-6 w-6 text-green-300" />}
                  </div>

                  {voice.sourceAudioUrl && <audio controls src={voice.sourceAudioUrl} className="mb-4 w-full" />}
                  {voice.errorMessage && <p className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{i18n.language.startsWith('pt') ? voice.errorMessage : t('voices.errors.voiceFailed')}</p>}

                  {voice.validateInfo && (
                    <div className="mb-4 rounded-2xl border border-primary-800 bg-primary-950/30 p-4">
                      <p className="text-xs font-bold uppercase text-primary-200">{t('voices.verification.phrase')}</p>
                      <p className="mt-2 text-lg font-black text-white">{voice.validateInfo}</p>
                      <p className="mt-2 text-sm text-gray-300">{t('voices.verification.instructions')}</p>
                      {(() => {
                        const secondsRemaining = getValidationSecondsRemaining(voice, nowMs)
                        const expired = secondsRemaining <= 0
                        return (
                          <div className={`mt-3 rounded-xl border p-3 text-sm ${expired ? 'border-yellow-700 bg-yellow-950/30 text-yellow-100' : 'border-purple-700/60 bg-black/30 text-purple-100'}`}>
                            {expired ? (
                              <>
                                <p className="font-bold">{t('voices.verification.expired')}</p>
                                <button type="button" onClick={() => regenerateValidationPhrase(voice.id)} disabled={refreshingId === voice.id} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-700 px-3 py-2 font-bold text-white disabled:opacity-60">
                                  {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />} {t('voices.verification.generateNewPhrase')}
                                </button>
                              </>
                            ) : (
                              <p><strong>{t('voices.verification.recommendedTime')}</strong> {formatCountdown(secondsRemaining)}</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {voice.status === 'awaiting_verification' && (
                    <form onSubmit={(event) => uploadVerification(event, voice.id)} className="mb-4 space-y-3">
                      <div className="rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
                        <p className="text-sm font-bold text-purple-100">{t('voices.verification.recordHere')}</p>
                        <p className="mt-1 text-xs text-purple-100/80">{t('voices.verification.recordHereHint')}</p>
                        {recordingVoiceId === voice.id ? (
                          <button type="button" onClick={stopRecordingVerification} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-600">
                            <FiMic /> {t('voices.verification.stopAndSend', { seconds: recordingSeconds })}
                          </button>
                        ) : (
                          <button type="button" onClick={() => startRecordingVerification(voice.id)} disabled={Boolean(recordingVoiceId) || verifyingId === voice.id} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                            <FiMic /> {t('voices.verification.recordNow')}
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">{t('voices.verification.orUpload')}</p>
                        <input name="audio" type="file" accept="audio/*" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white" />
                      </div>
                      <button disabled={verifyingId === voice.id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                        {verifyingId === voice.id ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
                        {t('voices.verification.sendFile')}
                      </button>
                    </form>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {voice.status === 'failed' && voice.sourceAudioUrl && (
                      String(voice.errorMessage || '').toLowerCase().includes('expir') ||
                      String(voice.errorMessage || '').toLowerCase().includes('phrase') ||
                      String(voice.errorMessage || '').toLowerCase().includes('frase')
                    ) && (
                      <button onClick={() => reactivateExpiredVoice(voice.id)} disabled={refreshingId === voice.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                        {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        {t('voices.actions.retryPhraseFree')}
                      </button>
                    )}
                    {voice.status !== 'ready' && (
                      <button onClick={() => refreshVoice(voice.id)} disabled={refreshingId === voice.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-black/30 px-4 py-3 font-bold text-gray-100 hover:bg-gray-900 disabled:opacity-60">
                        {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                        {t('voices.actions.refreshStatus')}
                      </button>
                    )}
                    <button onClick={() => deleteVoice(voice.id)} disabled={deletingId === voice.id} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 font-bold text-red-100 hover:bg-red-950/60 disabled:opacity-60">
                      {deletingId === voice.id ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                      {t('voices.actions.delete')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && recoverableVoices.length > 0 && (
            <section className="mt-8 rounded-3xl border border-purple-800/60 bg-purple-950/20 p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="text-xl font-black text-white">{t('voices.recover.title')}</h2>
                <p className="mt-2 text-sm text-purple-100/80">
                  {t('voices.recover.description')}
                </p>
                {voices.length >= limit && (
                  <p className="mt-3 rounded-xl border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-100">
                    {t('voices.recover.limitHint')}
                  </p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {recoverableVoices.map((voice) => (
                  <article key={voice.id} className="rounded-2xl border border-purple-800/60 bg-black/40 p-4">
                    <h3 className="text-lg font-black text-white">{voice.displayName}</h3>
                    <p className="mt-1 text-sm text-purple-100/70">{t('voices.recover.expiredSaved')}</p>
                    {voice.sourceAudioUrl && <audio controls src={voice.sourceAudioUrl} className="mt-4 w-full" />}
                    <button
                      onClick={() => reactivateExpiredVoice(voice.id)}
                      disabled={refreshingId === voice.id || voices.length >= limit}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60"
                    >
                      {refreshingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                      {t('voices.recover.reactivateFree')}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
