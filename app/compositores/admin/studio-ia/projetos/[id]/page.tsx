'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { FiArrowLeft, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiCloud, FiCode, FiCreditCard, FiDownload, FiExternalLink, FiEyeOff, FiFileText, FiHeadphones, FiHeart, FiLoader, FiLock, FiMic, FiMusic, FiPause, FiPlay, FiSave, FiShield, FiVideo, FiX, FiZap } from 'react-icons/fi'
import CopyButton from '@/components/CopyButton'

const refineActions = ['improve_chorus', 'sticky', 'sadder', 'modern', 'romantic', 'commercial'] as const

const MUSIC_GENERATION_TIMEOUT_SECONDS = 10 * 60
const MUSIC_GENERATION_BACKGROUND_SECONDS = 20
const STUDIO_MUSIC_CREDITS = 10

const inspirationVariationOptions = [
  { id: 'similar', labelKey: 'studio.project.inspiration.variations.similar' },
  { id: 'same_style_new_melody', labelKey: 'studio.project.inspiration.variations.sameStyleNewMelody' },
  { id: 'creative', labelKey: 'studio.project.inspiration.variations.creative' },
]

function canCreateFromStudioStatus(status: any) {
  return Boolean(status?.canCreateMusic) ||
    Number(status?.credits?.remaining || 0) >= STUDIO_MUSIC_CREDITS ||
    Number(status?.stats?.freeMusicRemaining || 0) > 0
}

function studioStatusFromComposerPayload(data: any) {
  const statementBalance = Number(data?.statement?.summary?.currentCreditBalance)
  const currentCreditBalance = Number.isFinite(statementBalance)
    ? Math.max(0, statementBalance)
    : Math.max(0, Number(data?.studio?.creditsRemaining) || 0)
  const freeMusicRemaining = Number(data?.studio?.freeMusicRemaining) || 0

  return {
    allowed: currentCreditBalance >= STUDIO_MUSIC_CREDITS || freeMusicRemaining > 0,
    canCreateMusic: currentCreditBalance >= STUDIO_MUSIC_CREDITS || freeMusicRemaining > 0,
    hasStudioPlan: Boolean(data?.plan?.hasStudioPlan),
    canPublish: Boolean(data?.plan?.hasStudioPlan || data?.composer?.isPremium || data?.composer?.hasActiveSubscription || data?.plan?.status === 'active'),
    credits: {
      limit: Number(data?.studio?.creditsLimit) || currentCreditBalance,
      used: Number(data?.studio?.creditsUsed) || 0,
      remaining: currentCreditBalance,
    },
    stats: {
      freeMusicRemaining,
      premiumCoverGenerations: 0,
      premiumCoverLimit: 0,
    },
  }
}

function formatGenerationTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatAudioDuration(value?: number | string | null) {
  const totalSeconds = Math.round(Number(value) || 0)
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function sanitizeDownloadName(value: string) {
  return `${String(value || 'dcc-music')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'dcc-music'}.mp3`
}

function sanitizeCoverDownloadName(value: string) {
  return `${String(value || 'capa-dcc-music')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'capa-dcc-music'}.jpg`
}

function StudioAudioPlayer({ src, label }: { src: string; label?: string }) {
  const { t } = useTranslation()
  const resolvedLabel = label || t('studio.project.audio.listen')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const audio = new Audio(src)
    audio.preload = 'metadata'
    audioRef.current = audio

    const handleLoadedMetadata = () => setDuration(Number(audio.duration) || 0)
    const handleTimeUpdate = () => setCurrentTime(Number(audio.currentTime) || 0)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [src])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const progress = progressRef.current
    if (!audio) return
    if (!progress || !duration) return

    const bounds = progress.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const nextTime = ratio * duration
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const downloadAudio = async () => {
    setDownloading(true)
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error('download_failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = sanitizeDownloadName(resolvedLabel)
      document.body.appendChild(link)
      link.click()
      link.remove()
      // O Safari/iOS conclui o download de blobs de forma assíncrona. Revogar a URL
      // imediatamente pode gerar um MP3 que chega ao WhatsApp com duração 0:00.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  const progressPercent = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white hover:bg-primary-600"
          aria-label={isPlaying ? t('studio.project.audio.pause') : t('studio.project.audio.play')}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{resolvedLabel}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-10 text-xs text-gray-400">{formatGenerationTime(Math.floor(currentTime))}</span>
            <div
              ref={progressRef}
              role="slider"
              aria-label={t('studio.project.audio.progress')}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.floor(duration))}
              aria-valuenow={Math.floor(currentTime)}
              onClick={handleSeek}
              className="h-3 min-w-0 flex-1 cursor-pointer rounded-full bg-gray-800 p-0.5"
            >
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="w-10 text-right text-xs text-gray-400">{duration ? formatGenerationTime(Math.floor(duration)) : '--:--'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadAudio}
          disabled={downloading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-gray-200 hover:border-primary-500 hover:text-white disabled:opacity-60"
          aria-label={t('studio.project.audio.download')}
        >
          {downloading ? <FiLoader className="animate-spin" /> : <FiDownload />}
        </button>
      </div>
    </div>
  )
}

function LearnYourMusicAd({
  studioVersionId,
  studioProjectId,
}: {
  studioVersionId?: string
  studioProjectId?: string
}) {
  const { t } = useTranslation()
  const items = [t('studio.project.chords.chords'), t('studio.project.chords.key'), 'BPM']
  const transcriptionParams = new URLSearchParams()
  if (studioVersionId) transcriptionParams.set('studioVersionId', studioVersionId)
  if (studioProjectId) transcriptionParams.set('studioProjectId', studioProjectId)
  const transcriptionHref = transcriptionParams.toString()
    ? `/transcricao-musical?${transcriptionParams.toString()}`
    : '/transcricao-musical'

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-amber-400/40 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_38%),linear-gradient(135deg,rgba(76,29,149,0.45),rgba(15,23,42,0.95),rgba(0,0,0,0.95))] p-4 shadow-xl shadow-amber-950/20">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
        <FiMusic /> {t('studio.project.chords.badge')}
      </div>
      <h2 className="text-xl font-black text-white">{t('studio.project.chords.title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        {t('studio.project.chords.description')}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-gray-100">
            <FiCheckCircle className="shrink-0 text-green-300" />
            {item}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{t('studio.project.chords.price')}</p>
          <p className="text-2xl font-black text-amber-200">{t('studio.project.chords.credits')}</p>
        </div>
        <Link
          href={transcriptionHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-3 text-sm font-black text-black hover:from-amber-300 hover:to-yellow-400"
        >
          <FiFileText /> {t('studio.project.chords.generate')}
        </Link>
      </div>
    </div>
  )
}

function extractVoicePreferences(description?: string | null) {
  const match = String(description || '').match(/Preferência de voz:\s*(.+)/i)
  return match?.[1]?.trim() || ''
}

function dedupeProjectCovers(covers: any[]) {
  if (!Array.isArray(covers)) return []

  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()

  return covers.filter((cover: any) => {
    const id = String(cover?.id || '').trim()
    const url = String(cover?.imageUrl || '').trim()

    if (id && seenIds.has(id)) return false
    if (url && seenUrls.has(url)) return false

    if (id) seenIds.add(id)
    if (url) seenUrls.add(url)
    return Boolean(id || url)
  })
}

function dedupeStudioVersions(versions: any[]) {
  if (!Array.isArray(versions)) return []

  const seenIds = new Set<string>()
  const seenAudio = new Set<string>()

  return versions.filter((version: any) => {
    const id = String(version?.id || '').trim()
    const audioKey = String(version?.audioUrl || version?.streamAudioUrl || '').trim()

    if (id && seenIds.has(id)) return false
    if (audioKey && seenAudio.has(audioKey)) return false

    if (id) seenIds.add(id)
    if (audioKey) seenAudio.add(audioKey)
    return true
  })
}

function getStudioVersionNumber(versions: any[], versionId?: string | null) {
  if (!versionId || !Array.isArray(versions) || versions.length === 0) return 0
  const index = versions.findIndex((version) => version.id === versionId)
  if (index < 0) return 0
  return versions.length - index
}

function normalizeStudioVideoRequest(videoRequest: any) {
  if (!videoRequest) return null
  return {
    id: videoRequest.id,
    status: videoRequest.status,
    amount: videoRequest.amount,
    providerTaskId: videoRequest.providerTaskId || videoRequest.provider_task_id || null,
    videoUrl: videoRequest.videoUrl || videoRequest.video_url || null,
    errorMessage: videoRequest.errorMessage || videoRequest.error_message || null,
    paidAt: videoRequest.paidAt || videoRequest.paid_at || null,
    completedAt: videoRequest.completedAt || videoRequest.completed_at || null,
    createdAt: videoRequest.createdAt || videoRequest.created_at || null,
    updatedAt: videoRequest.updatedAt || videoRequest.updated_at || null,
    versionId: videoRequest.versionId || videoRequest.metadata?.version_id || null,
    versionName: videoRequest.versionName || videoRequest.metadata?.version_name || null,
    canRegenerate: Boolean(videoRequest.canRegenerate),
  }
}

const videoRequestStatus = new Set(['payment_pending', 'requested', 'in_production', 'retry_pending', 'completed', 'cancelled', 'failed'])

export default function StudioProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { t, i18n } = useTranslation()
  const projectId = String(params.id)
  const musicGenerationMessages = [1,2,3,4,5,6,7].map((index) => t(`studio.project.generation.messages.${index}`))
  const musicGenerationBackgroundMessage = t('studio.project.generation.background')
  const musicGenerationCommunicationError = t('studio.project.generation.communicationError')
  const musicCreationUnavailableMessage = t('studio.project.generation.unavailable')
  const studioVoiceInvalidMessage = t('studio.project.generation.voiceInvalid')
  const publishPlanRequiredMessage = t('studio.project.publish.planRequired')
  const [project, setProject] = useState<any>(null)
  const [lyric, setLyric] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState('')
  const musicGenerationLockRef = useRef(false)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0)
  const [generationBackgroundMode, setGenerationBackgroundMode] = useState(false)
  const [previewAudioUrl, setPreviewAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [studioStatus, setStudioStatus] = useState<any>(null)
  const [voices, setVoices] = useState<any[]>([])
  const [invalidVoiceIds, setInvalidVoiceIds] = useState<string[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [extraInstructions, setExtraInstructions] = useState('')
  const [selectedInspirationVariation, setSelectedInspirationVariation] = useState('similar')
  const [videoCheckoutLoading, setVideoCheckoutLoading] = useState(false)
  const [videoCreditConfirmation, setVideoCreditConfirmation] = useState<{ replaceExisting: boolean } | null>(null)
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState('')
  const [upgradeModalMessage, setUpgradeModalMessage] = useState('')
  const [showPublishPlanModal, setShowPublishPlanModal] = useState(false)
  const [showIncorporateCode, setShowIncorporateCode] = useState(false)
  const [showInspirationPicker, setShowInspirationPicker] = useState(false)
  const [preselectedInspirationVersionId, setPreselectedInspirationVersionId] = useState('')
  const backgroundMessageRef = useRef<HTMLDivElement | null>(null)
  const inspirationPickerRef = useRef<HTMLDivElement | null>(null)
  const coverCarouselRef = useRef<HTMLDivElement | null>(null)
  const lastFocusedMessageRef = useRef('')

  useEffect(() => {
    loadProject()
  }, [projectId])

  useEffect(() => {
    loadVoices()
  }, [])

  useEffect(() => {
    const storedVoiceId = localStorage.getItem(`studio_selected_voice:${projectId}`)
    if (storedVoiceId) setSelectedVoiceId(storedVoiceId)

    const storedExtraInstructions = localStorage.getItem(`studio_extra_instructions:${projectId}`)
    if (storedExtraInstructions) setExtraInstructions(storedExtraInstructions)
  }, [projectId])

  useEffect(() => {
    if (!generationId) return

    const interval = setInterval(() => {
      checkGeneration(generationId)
    }, 8000)

    return () => clearInterval(interval)
  }, [generationId])

  useEffect(() => {
    if (!generationId) return

    const interval = setInterval(() => {
      loadProject({ silent: true, notifyReady: true, skipGenerationCheck: true })
    }, 15000)

    return () => clearInterval(interval)
  }, [generationId])

  useEffect(() => {
    if (message !== musicGenerationBackgroundMessage || lastFocusedMessageRef.current === message) return

    lastFocusedMessageRef.current = message
    window.setTimeout(() => {
      backgroundMessageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      backgroundMessageRef.current?.focus({ preventScroll: true })
    }, 100)
  }, [message])

  useEffect(() => {
    if (!generationId) return

    const refreshGeneration = () => {
      if (document.visibilityState === 'visible') {
        checkGeneration(generationId)
      }
    }

    window.addEventListener('focus', refreshGeneration)
    document.addEventListener('visibilitychange', refreshGeneration)

    return () => {
      window.removeEventListener('focus', refreshGeneration)
      document.removeEventListener('visibilitychange', refreshGeneration)
    }
  }, [generationId])

  useEffect(() => {
    const hasReadyAudio = Boolean(
      project?.version?.audioUrl ||
      project?.version?.streamAudioUrl ||
      project?.versions?.some((version: any) => version.audioUrl || version.streamAudioUrl)
    )

    if (!project || !hasReadyAudio || project.cover?.imageUrl) return

    let attempts = 0
    const interval = window.setInterval(async () => {
      attempts += 1
      const updatedProject = await loadProject({
        silent: true,
        skipGenerationCheck: true,
        suppressError: true,
      })

      if (updatedProject?.project?.cover?.imageUrl || attempts >= 12) {
        window.clearInterval(interval)
      }
    }, 5000)

    return () => window.clearInterval(interval)
  }, [projectId, project?.cover?.imageUrl, project?.version?.audioUrl, project?.version?.streamAudioUrl, project?.versions?.length])

  useEffect(() => {
    const versions = Array.isArray(project?.versions) ? project.versions : []
    const hasAudio = versions.some((version: any) => version.audioUrl || version.streamAudioUrl)
    const isFinalizing = Boolean(project?.status === 'ready' && versions.length > 0 && !hasAudio)
    if (!isFinalizing) return

    // O callback já pode ter confirmado a música, mas o MP3 ainda está sendo
    // copiado para o storage. Atualiza sozinho até o player poder tocar.
    const interval = window.setInterval(() => {
      loadProject({ silent: true, skipGenerationCheck: true, suppressError: true })
    }, 4000)

    return () => window.clearInterval(interval)
  }, [project?.status, project?.versions])

  useEffect(() => {
    if (!generationId) {
      setGenerationMessageIndex(0)
      setGenerationElapsedSeconds(0)
      setGenerationBackgroundMode(false)
      setPreviewAudioUrl('')
      return
    }

    const interval = setInterval(() => {
      setGenerationMessageIndex((currentIndex) => currentIndex + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [generationId])

  useEffect(() => {
    if (!generationId) return

    const interval = setInterval(() => {
      setGenerationElapsedSeconds((currentSeconds) => currentSeconds + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [generationId])

  useEffect(() => {
    if (!generationId) return

    if (generationElapsedSeconds >= MUSIC_GENERATION_TIMEOUT_SECONDS) {
      const timedOutGenerationId = generationId
      setGenerationId(null)
      setPreviewAudioUrl('')
      setGenerationBackgroundMode(false)
      setMessage('')
      void (async () => {
        await checkGeneration(timedOutGenerationId)
        setError((current) => current || musicGenerationCommunicationError)
      })()
      return
    }

    if (generationElapsedSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS) {
      setGenerationBackgroundMode(true)
      setMessage(musicGenerationBackgroundMessage)
    }
  }, [generationId, generationElapsedSeconds])

  const loadProject = async (options?: { silent?: boolean; notifyReady?: boolean; skipGenerationCheck?: boolean; suppressError?: boolean }) => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const response = await fetch(`/api/compositores/studio/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.detail.loadError'))
      const projectVersions = dedupeStudioVersions(data.project.versions)
      const normalizedProject = {
        ...data.project,
        versions: projectVersions,
      }
      const projectAudioUrl = normalizedProject.version?.audioUrl || normalizedProject.version?.streamAudioUrl
      const hasReadyAudio = Boolean(projectAudioUrl || projectVersions.some((version: any) => version.audioUrl || version.streamAudioUrl))
      const activeGenerationHasReadyAudio = Boolean(
        data.activeGeneration?.id && projectVersions.some((version: any) =>
          version.generationId === data.activeGeneration.id && (version.audioUrl || version.streamAudioUrl)
        )
      )
      const activeGenerationRunning = Boolean(
        data.activeGeneration?.id &&
        ['pending', 'processing', 'first_ready'].includes(String(data.activeGeneration.status || ''))
      )
      setProject(normalizedProject)
      setLyric(normalizedProject.lyric || '')

      if (activeGenerationRunning && !activeGenerationHasReadyAudio) {
        const createdAt = new Date(data.activeGeneration.createdAt).getTime()
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))

        if (elapsedSeconds >= MUSIC_GENERATION_TIMEOUT_SECONDS) {
          setGenerationId(null)
          setPreviewAudioUrl('')
          setGenerationBackgroundMode(false)
          setMessage('')
          if (!options?.skipGenerationCheck) {
            await checkGeneration(data.activeGeneration.id)
          } else {
            setError(musicGenerationCommunicationError)
          }
        } else {
          // Mantém a tela de produção mesmo se o projeto já tiver versões antigas.
          setGenerationId(data.activeGeneration.id)
          setGenerationElapsedSeconds(elapsedSeconds)
          setGenerationBackgroundMode(elapsedSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS)
          if (elapsedSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS) {
            setMessage(musicGenerationBackgroundMessage)
          } else if (message === musicGenerationBackgroundMessage) {
            setMessage('')
          }
          if (!options?.skipGenerationCheck) {
            checkGeneration(data.activeGeneration.id)
          }
        }
      } else if (hasReadyAudio) {
        setGenerationId(null)
        setGenerationBackgroundMode(false)
        setPreviewAudioUrl('')
        if (options?.notifyReady) {
          setMessage(t('studio.project.generation.readyUpdated'))
        } else if (message === musicGenerationBackgroundMessage) {
          setMessage('')
        }
      }

      await refreshStudioStatus(token)

      return { ...data, project: normalizedProject }
    } catch (err: any) {
      if (!options?.suppressError) {
        setError(err.message || t('studio.project.detail.loadError'))
      }
      return null
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  const loadVoices = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    try {
      const response = await fetch('/api/compositores/studio/voices', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setVoices((data.voices || []).filter((voice: any) => voice.status === 'ready' && voice.isAvailable && voice.voiceId))
      }
    } catch {
      setVoices([])
    }
  }

  const handleVoiceSelection = (voiceProfileId: string) => {
    setSelectedVoiceId(voiceProfileId)

    if (!voiceProfileId) {
      localStorage.removeItem(`studio_selected_voice:${projectId}`)
      return
    }

    localStorage.setItem(`studio_selected_voice:${projectId}`, voiceProfileId)
  }

  const handleExtraInstructionsChange = (value: string) => {
    const nextValue = value.slice(0, 700)
    setExtraInstructions(nextValue)

    if (!nextValue.trim()) {
      localStorage.removeItem(`studio_extra_instructions:${projectId}`)
      return
    }

    localStorage.setItem(`studio_extra_instructions:${projectId}`, nextValue)
  }

  const saveLyric = async () => {
    const token = localStorage.getItem('composer_token')
    setProcessing(t('studio.project.detail.savingLyrics'))
    try {
      const response = await fetch(`/api/compositores/studio/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lyric }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.detail.saveLyricsError'))
      setMessage(t('studio.project.detail.lyricsSaved'))
    } catch (err: any) {
      setError(err.message || t('studio.project.detail.saveLyricsError'))
    } finally {
      setProcessing('')
    }
  }

  const refreshStudioStatus = async (token: string) => {
    const statusResponse = await fetch('/api/compositores/studio/status', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const statusData = await statusResponse.json().catch(() => null)

    if (statusResponse.ok && statusData) {
      setStudioStatus(statusData)
      if (canCreateFromStudioStatus(statusData)) {
        return {
          ...statusData,
          canCreateMusic: true,
        }
      }
    }

    const composerResponse = await fetch('/api/compositores/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const composerData = await composerResponse.json().catch(() => null)
    if (composerResponse.ok && composerData) {
      const fallbackStatus = studioStatusFromComposerPayload(composerData)
      if (fallbackStatus.canCreateMusic || !statusData) {
        setStudioStatus((currentStatus: any) => ({
          ...(currentStatus || statusData || {}),
          ...fallbackStatus,
          stats: {
            ...((currentStatus || statusData)?.stats || {}),
            ...fallbackStatus.stats,
          },
        }))
        return fallbackStatus
      }
    }

    return statusData
  }

  const refineLyric = async (action: string) => {
    const token = localStorage.getItem('composer_token')
    setProcessing(t('studio.project.detail.refiningLyrics'))
    try {
      const response = await fetch('/api/compositores/studio/lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          title: project.title,
          style: project.style,
          mood: project.mood,
          structure: project.structure,
          lineCount: project.lineCount,
          idea: project.description,
          existingLyric: lyric,
          action,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.detail.refineLyricsError'))
      setLyric(data.lyric)
      setMessage(t('studio.project.detail.lyricsUpdated'))
    } catch (err: any) {
      setError(err.message || t('studio.project.detail.refineLyricsError'))
    } finally {
      setProcessing('')
    }
  }

  const createMusic = async () => {
    if (musicGenerationLockRef.current) return
    musicGenerationLockRef.current = true
    setProcessing(t('studio.project.generation.creating'))

    try {
      const token = localStorage.getItem('composer_token')
      if (!token) {
        router.push('/compositores/login')
        return
      }

      const latestStudioStatus = await refreshStudioStatus(token)
      if (!latestStudioStatus?.canCreateMusic) {
        const upgradeMessage = t('studio.project.generation.noCredits')
        setError('')
        setUpgradeModalMessage(upgradeMessage)
        return
      }

      if (selectedVoiceId && invalidVoiceIds.includes(selectedVoiceId)) {
        setError(studioVoiceInvalidMessage)
        return
      }

      setError('')
      setMessage('')
      await saveLyric()
      const response = await fetch('/api/compositores/studio/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          lyric,
          voiceProfileId: selectedVoiceId || null,
          extraInstructions: extraInstructions.trim() || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(t('studio.project.generation.createError'))
      if (typeof data.lyric === 'string' && data.lyric.trim()) {
        setLyric(data.lyric)
      }
      window.dispatchEvent(new Event('studioBalanceChange'))
      await refreshStudioStatus(token)
      setGenerationId(data.generationId)
      setGenerationBackgroundMode(false)
      setGenerationElapsedSeconds(0)
      setMessage('')
      checkGeneration(data.generationId)
    } catch (err: any) {
      const recoveredProject = await loadProject({
        silent: true,
        notifyReady: true,
        suppressError: true,
      })
      if (recoveredProject?.activeGeneration?.id) {
        setError('')
        setMessage(musicGenerationBackgroundMessage)
        return
      }

      const rawErrorMessage = err.message || t('studio.project.generation.createError')
      if (rawErrorMessage === studioVoiceInvalidMessage && selectedVoiceId) {
        setInvalidVoiceIds((current) => current.includes(selectedVoiceId) ? current : [...current, selectedVoiceId])
      }
      const errorMessage = rawErrorMessage.toLowerCase().includes('fetch failed')
        ? musicCreationUnavailableMessage
        : rawErrorMessage
      setError(errorMessage)
      if (errorMessage.toLowerCase().includes('música grátis') || errorMessage.toLowerCase().includes('assine um plano')) {
        setUpgradeModalMessage(errorMessage)
      }
    } finally {
      musicGenerationLockRef.current = false
      setProcessing('')
    }
  }

  const retryEnhanceFromOriginal = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    const latestStudioStatus = await refreshStudioStatus(token)
    if (!latestStudioStatus?.canCreateMusic) {
      const upgradeMessage = t('studio.project.generation.retryNeedsCredits')
      setError('')
      setUpgradeModalMessage(upgradeMessage)
      return
    }

    if (!lyric.trim()) {
      setError(t('studio.project.generation.saveLyricsFirst'))
      return
    }

    setProcessing(t('studio.project.generation.retryingOriginal'))
    setError('')
    setMessage('')

    try {
      await saveLyric()
      setProcessing(t('studio.project.generation.retryingOriginal'))
      const response = await fetch(`/api/compositores/studio/projects/${projectId}/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lyric,
          extraInstructions: extraInstructions.trim() || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(t('studio.project.generation.retryError'))

      window.dispatchEvent(new Event('studioBalanceChange'))
      await refreshStudioStatus(token)
      setGenerationId(data.generationId)
      setGenerationBackgroundMode(false)
      setGenerationElapsedSeconds(0)
      setMessage('')
      checkGeneration(data.generationId)
    } catch (err: any) {
      const recoveredProject = await loadProject({
        silent: true,
        notifyReady: true,
        suppressError: true,
      })
      if (recoveredProject?.activeGeneration?.id) {
        setError('')
        setMessage(musicGenerationBackgroundMessage)
        return
      }

      const errorMessage = err.message || t('studio.project.generation.retryError')
      setError(errorMessage)
      if (errorMessage.toLowerCase().includes('música grátis') || errorMessage.toLowerCase().includes('créditos')) {
        setUpgradeModalMessage(errorMessage)
      }
    } finally {
      setProcessing('')
    }
  }

  const reuseLyricInNewProject = async (sourceVersionId?: string) => {
    closeInspirationPicker()
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    const latestStudioStatus = await refreshStudioStatus(token)
    if (!latestStudioStatus?.canCreateMusic) {
      const upgradeMessage = t('studio.project.generation.reuseNoCredits')
      setError('')
      setUpgradeModalMessage(upgradeMessage)
      return
    }

    if (!lyric.trim()) {
      setError(t('studio.project.generation.noLyricsToReuse'))
      return
    }

    setProcessing(t('studio.project.generation.creatingNewProject'))
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/compositores/studio/projects/${projectId}/inspiration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          variation: selectedInspirationVariation,
          lyric,
          sourceVersionId,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.generation.newProjectError'))

      router.push(`/compositores/admin/studio-ia/projetos/${data.project.id}`)
    } catch (err: any) {
      setError(err.message || t('studio.project.generation.reuseError'))
      setProcessing('')
    }
  }

  const scrollInspirationPicker = (direction: 'left' | 'right') => {
    inspirationPickerRef.current?.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    })
  }

  const scrollCoverCarousel = (direction: 'left' | 'right') => {
    const width = coverCarouselRef.current?.clientWidth || 320
    coverCarouselRef.current?.scrollBy({
      left: direction === 'left' ? -width : width,
      behavior: 'smooth',
    })
  }

  const openInspirationPickerForVersion = (versionId: string) => {
    setPreselectedInspirationVersionId(versionId)
    setShowInspirationPicker(true)
  }

  const closeInspirationPicker = () => {
    setShowInspirationPicker(false)
    setPreselectedInspirationVersionId('')
  }

  useEffect(() => {
    if (!showInspirationPicker || !preselectedInspirationVersionId) return

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`inspiration-version-${preselectedInspirationVersionId}`)
      target?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [showInspirationPicker, preselectedInspirationVersionId])

  const checkGeneration = async (id: string) => {
    const token = localStorage.getItem('composer_token')
    const response = await fetch(`/api/compositores/studio/music/status?generationId=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await response.json()
    if (!response.ok) {
      setGenerationId(null)
      setPreviewAudioUrl('')
      setError(data.error || t('studio.project.generation.statusError'))
      return
    }

    if (data.generation?.status === 'failed') {
      setGenerationId(null)
      setPreviewAudioUrl('')
      setGenerationBackgroundMode(false)
      setMessage('')
      const generationError = String(data.generation?.error_message || '')
      const normalizedGenerationError = generationError.toLowerCase()
      const isExpiredVoiceError =
        normalizedGenerationError.includes('voice has expired') ||
        normalizedGenerationError.includes('voz cadastrada') ||
        normalizedGenerationError.includes('voz personalizada') && normalizedGenerationError.includes('expir')
      setError(isExpiredVoiceError ? studioVoiceInvalidMessage : (generationError || musicGenerationCommunicationError))
      await loadProject({ silent: true, skipGenerationCheck: true, suppressError: true })
      return
    }

    if (data.version?.streamAudioUrl && !data.version?.audioUrl) {
      setPreviewAudioUrl(data.version.streamAudioUrl)
    }

    if (data.awaitingAudioSync) {
      setGenerationBackgroundMode(true)
      setMessage(t('studio.project.generation.syncingAudio'))
    }

    if (data.cover?.imageUrl) {
      setProject((currentProject: any) => currentProject ? ({
        ...currentProject,
        cover: data.cover,
      }) : currentProject)
    }

    if (data.version?.audioUrl || data.version?.streamAudioUrl) {
      setGenerationId(null)
      setGenerationBackgroundMode(false)
      setPreviewAudioUrl('')
      await loadProject({ silent: true, notifyReady: true })
      setMessage(t('studio.project.messages.ready'))
    }
  }

  const closeGenerationModal = async () => {
    const currentGenerationId = generationId
    setGenerationBackgroundMode(true)
    setMessage(musicGenerationBackgroundMessage)

    if (currentGenerationId) {
      await checkGeneration(currentGenerationId)
      await loadProject({ silent: true, notifyReady: true })
    }
  }

  const improveCover = async () => {
    const token = localStorage.getItem('composer_token')
    setError('')
    setMessage('')

    if ((studioStatus?.stats?.premiumCoverLimit || 0) <= 0) {
      setError(t('studio.project.cover.proOnly'))
      return
    }

    setProcessing(t('studio.project.cover.generating'))
    try {
      const response = await fetch('/api/compositores/studio/covers/premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.cover.error'))
      setProject((currentProject: any) => ({
        ...currentProject,
        cover: data.cover,
        covers: [
          { ...data.cover, isCurrent: true, createdAt: new Date().toISOString() },
          ...(Array.isArray(currentProject?.covers)
            ? currentProject.covers.map((item: any) => ({ ...item, isCurrent: false })).filter((item: any) => item.id !== data.cover.id)
            : []),
        ],
      }))
      await loadProject({ silent: true, skipGenerationCheck: true, suppressError: true })
      setStudioStatus((currentStatus: any) => currentStatus ? ({
        ...currentStatus,
        stats: {
          ...currentStatus.stats,
          premiumCoverGenerations: (currentStatus.stats?.premiumCoverGenerations || 0) + 1,
        },
      }) : currentStatus)
      setMessage(t('studio.project.cover.created'))
    } catch (err: any) {
      setError(err.message || t('studio.project.cover.error'))
    } finally {
      setProcessing('')
    }
  }

  const publishProject = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push(`/compositores/login?redirect=${encodeURIComponent(`/compositores/admin/studio-ia/projetos/${projectId}`)}`)
      return
    }

    setError('')
    setMessage('')

    const latestStudioStatus = await refreshStudioStatus(token)
    if (!latestStudioStatus?.canPublish) {
      setShowPublishPlanModal(true)
      return
    }

    setProcessing(t('studio.project.publish.publishing'))
    try {
      const response = await fetch('/api/compositores/studio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 403) {
          setShowPublishPlanModal(true)
          return
        }
        throw new Error(t('studio.project.publish.error'))
      }
      setProject((currentProject: any) => ({ ...currentProject, status: 'published', publicSlug: data.publicSlug }))
      setMessage(t('studio.project.publish.published'))
    } catch (err: any) {
      setError(err.message || t('studio.project.publish.error'))
    } finally {
      setProcessing('')
    }
  }

  const unpublishProject = async () => {
    const token = localStorage.getItem('composer_token')
    setError('')
    setMessage('')

    if (!window.confirm(t('studio.project.publish.unpublishConfirm'))) {
      return
    }

    setProcessing(t('studio.project.publish.unpublishing'))
    try {
      const response = await fetch('/api/compositores/studio/unpublish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.publish.unpublishError'))
      setProject((currentProject: any) => ({
        ...currentProject,
        status: 'ready',
        publicSlug: null,
      }))
      setMessage(t('studio.project.publish.unpublished'))
    } catch (err: any) {
      setError(err.message || t('studio.project.publish.unpublishError'))
    } finally {
      setProcessing('')
    }
  }

  const downloadCoverImage = async (coverUrlOverride?: string) => {
    const coverUrl = coverUrlOverride || project?.cover?.imageUrl
    if (!coverUrl) return

    try {
      const response = await fetch(coverUrl)
      if (!response.ok) throw new Error('download_failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = sanitizeCoverDownloadName(project?.title || 'capa-dcc-music')
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(coverUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const manageProjectCover = async (action: 'select' | 'delete', coverId: string) => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    if (action === 'delete' && !window.confirm(t('studio.project.cover.deleteConfirm'))) {
      return
    }

    setError('')
    setMessage('')
    setProcessing(action === 'select' ? t('studio.project.detail.selectingCover') : t('studio.project.detail.deletingCover'))

    try {
      const response = await fetch('/api/compositores/studio/covers/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, coverId, action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.detail.manageCoverError'))

      await loadProject({ silent: true, skipGenerationCheck: true, suppressError: true })
      setMessage(action === 'select' ? t('studio.project.cover.primaryUpdated') : t('studio.project.cover.deleted'))
    } catch (err: any) {
      setError(err.message || t('studio.project.detail.manageCoverError'))
    } finally {
      setProcessing('')
    }
  }

  useEffect(() => {
    const requests = [
      ...(Array.isArray(project?.videoRequests) ? project.videoRequests : []),
      project?.videoRequest,
    ].filter(Boolean)
    const hasActive = requests.some((item: any) => ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(item.status))
    if (!hasActive) return

    const interval = window.setInterval(() => {
      loadProject({ silent: true, skipGenerationCheck: true, suppressError: true })
    }, 10000)

    return () => window.clearInterval(interval)
  }, [project?.videoRequest?.id, project?.videoRequest?.status, project?.videoRequests])

  const requestVideoClip = async (replaceExisting = false) => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push(`/compositores/login?redirect=${encodeURIComponent(`/compositores/admin/studio-ia/projetos/${projectId}`)}`)
      return
    }

    const versions = Array.isArray(project?.versions) ? project.versions : []
    const readyVersions = versions.filter((version: any) => version.audioUrl || version.streamAudioUrl)
    const versionId = (
      selectedVideoVersionId && readyVersions.some((version: any) => version.id === selectedVideoVersionId)
        ? selectedVideoVersionId
        : readyVersions.find((version: any) => version.isCurrent)?.id || readyVersions[0]?.id || project?.version?.id || ''
    )

    if (!versionId) {
      setError(t('studio.project.video.selectAudio'))
      return
    }

    setError('')
    setMessage('')
    setVideoCheckoutLoading(true)

    try {
      const response = await fetch('/api/compositores/studio/video/preferencia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, versionId, replaceExisting }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(t('studio.project.video.generateError'))

      const mappedVideoRequest = normalizeStudioVideoRequest(data.videoRequest)
      if (mappedVideoRequest) {
        setProject((currentProject: any) => {
          if (!currentProject) return currentProject
          const currentRequests = Array.isArray(currentProject.videoRequests) ? currentProject.videoRequests : []
          return {
            ...currentProject,
            videoRequest: mappedVideoRequest,
            videoRequests: [
              mappedVideoRequest,
              ...currentRequests.filter((item: any) => item.id !== mappedVideoRequest.id),
            ],
          }
        })
        setMessage(data.message || t('studio.project.video.processing'))
        setVideoCheckoutLoading(false)
        return
      }

      throw new Error(t('studio.project.video.noStatus'))
    } catch (err: any) {
      setError(err.message || t('studio.project.video.generateError'))
      setVideoCheckoutLoading(false)
    }
  }

  const confirmVideoCredit = () => {
    if (!videoCreditConfirmation) return
    const { replaceExisting } = videoCreditConfirmation
    setVideoCreditConfirmation(null)
    void requestVideoClip(replaceExisting)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-10 w-10 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!project) {
    return <div className="min-h-screen py-10 text-center text-gray-400">{error || t('studio.project.notFound')}</div>
  }

  const audioUrl = project.version?.audioUrl || project.version?.streamAudioUrl
  const projectVersions = dedupeStudioVersions(project.versions)
  const projectCovers = dedupeProjectCovers(
    Array.isArray(project.covers) && project.covers.length > 0
      ? project.covers
      : project.cover?.imageUrl
        ? [{ ...project.cover, isCurrent: true }]
        : []
  ).sort((a: any, b: any) => Number(Boolean(b.isCurrent)) - Number(Boolean(a.isCurrent)))
  const shouldShowVersionList = projectVersions.length > 0
  const isGeneratingCover = processing === t('studio.project.cover.generating')
  const generationMessage = musicGenerationMessages[generationMessageIndex % musicGenerationMessages.length]
  const premiumCoverLimit = studioStatus?.stats?.premiumCoverLimit || 0
  const premiumCoverGenerations = studioStatus?.stats?.premiumCoverGenerations || 0
  const hasStudioPlan = Boolean(studioStatus?.hasStudioPlan)
  const canPublishOnDcc = Boolean(studioStatus?.canPublish)
  const canCreateMusic = canCreateFromStudioStatus(studioStatus)
  const canReuseLyric = canCreateFromStudioStatus(studioStatus)
  const canGeneratePremiumCover = Boolean(studioStatus) && premiumCoverLimit > 0 && premiumCoverGenerations < premiumCoverLimit
  const videoReadyVersions = projectVersions.filter((version: any) => version.audioUrl || version.streamAudioUrl)
  const resolvedVideoVersionId = (
    selectedVideoVersionId && videoReadyVersions.some((version: any) => version.id === selectedVideoVersionId)
      ? selectedVideoVersionId
      : videoReadyVersions.find((version: any) => version.isCurrent)?.id || videoReadyVersions[0]?.id || project.version?.id || ''
  )
  const selectedVideoVersion = videoReadyVersions.find((version: any) => version.id === resolvedVideoVersionId) || null
  const selectedVideoVersionNumber = getStudioVersionNumber(projectVersions, resolvedVideoVersionId)
  const selectedVideoAudioUrl = selectedVideoVersion?.audioUrl || selectedVideoVersion?.streamAudioUrl || ''
  const allVideoRequests = [
    ...(Array.isArray(project.videoRequests) ? project.videoRequests : []),
    project.videoRequest,
  ]
    .map((item: any) => normalizeStudioVideoRequest(item))
    .filter(Boolean)
    .filter((item: any, index: number, list: any[]) => list.findIndex((other) => other.id === item.id) === index)
  const currentVideoRequest = allVideoRequests.find((item: any) => item.versionId === resolvedVideoVersionId)
    || (selectedVideoVersion?.isCurrent
      ? allVideoRequests.find((item: any) => !item.versionId)
      : null)
    || null
  const hasActiveVideoRequest = allVideoRequests.some((item: any) => ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(item.status))
  const selectedVideoIsActive = Boolean(currentVideoRequest && ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(currentVideoRequest.status))
  const selectedVideoIsReady = Boolean(currentVideoRequest?.status === 'completed' && currentVideoRequest.videoUrl)
  const canRegenerateSelectedVideo = Boolean(currentVideoRequest?.canRegenerate)
  const inspiration = project.inspiration
  const canRetryEnhance = Boolean(project.enhanceSource?.available)
  const voicePreferences = extractVoicePreferences(project.description)
  const incorporateCode = project.publicSlug
    ? `<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://www.dccmusic.online'}/embed/studio/${project.publicSlug}" width="100%" height="180" frameborder="0" allow="autoplay; encrypted-media" loading="lazy"></iframe>`
    : ''
  const hasProjectReadyAudio = Boolean(audioUrl || projectVersions.some((version: any) => version.audioUrl || version.streamAudioUrl))
  const isMusicRequestPending = Boolean(generationId && generationBackgroundMode)
  const visibleMessage = message === musicGenerationBackgroundMessage && !isMusicRequestPending
    ? ''
    : message
  const currentStudioVersionId =
    project.version?.id ||
    projectVersions.find((version: any) => version.isCurrent)?.id ||
    projectVersions[0]?.id ||
    undefined

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden py-4 sm:py-7">
      <div className="mx-auto w-full max-w-[100vw] px-3 sm:max-w-7xl sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-full sm:max-w-7xl">
          <Link href="/compositores/admin/studio-ia/projetos" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-300 transition hover:text-primary-200">
            <FiArrowLeft /> Meus Projetos
          </Link>

          {(processing || (generationId && !generationBackgroundMode)) && (
            <StudioProcessing
              message={processing || generationMessage}
              description={generationId && !processing ? t('studio.project.detail.backgroundHint') : undefined}
              elapsedTime={generationId && !processing ? formatGenerationTime(generationElapsedSeconds) : undefined}
              previewAudioUrl={generationId && !processing ? previewAudioUrl : undefined}
              onClose={generationId && !processing ? closeGenerationModal : undefined}
            />
          )}

          {upgradeModalMessage && (
            <UpgradeModal
              message={upgradeModalMessage}
              onClose={() => setUpgradeModalMessage('')}
            />
          )}

          {showPublishPlanModal && (
            <PublishPlanModal message={publishPlanRequiredMessage} onClose={() => setShowPublishPlanModal(false)} />
          )}

          {videoCreditConfirmation && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md rounded-[2rem] border border-fuchsia-400/30 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.25),transparent_45%),linear-gradient(135deg,#080712,#15071d)] p-6 shadow-2xl shadow-fuchsia-950/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-200">
                  <FiVideo className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-black text-white">{t('studio.project.video.confirmTitle')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">
                  {t('studio.project.video.confirmText')}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-fuchsia-100/80">
                  {t('studio.project.video.transitionHint')}
                </p>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setVideoCreditConfirmation(null)}
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/[0.06]"
                  >
                    {t('common.actions.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={confirmVideoCredit}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 text-sm font-black text-white transition hover:from-fuchsia-500 hover:to-purple-500"
                  >
                    Continuar
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showInspirationPicker && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 px-3 py-5 backdrop-blur-sm sm:px-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-purple-400/30 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#050816,#090b16,#18092c)] shadow-2xl shadow-purple-950/50"
              >
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">{t('studio.project.inspiration.eyebrow')}</p>
                    <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{t('studio.project.inspiration.title')}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
                      {t('studio.project.inspiration.description')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeInspirationPicker}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 p-2 text-gray-300 transition hover:text-white sm:static"
                    aria-label={t('common.actions.close')}
                  >
                    <FiX />
                  </button>
                </div>

                <div className="border-b border-white/10 px-4 py-3 sm:px-5">
                  <p className="mb-2 text-xs font-bold text-purple-100">{t('studio.project.inspiration.howTransform')}</p>
                  <div className="flex flex-wrap gap-2">
                    {inspirationVariationOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedInspirationVariation(option.id)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selectedInspirationVariation === option.id ? 'border-primary-300 bg-primary-600 text-white' : 'border-purple-800/70 bg-black/25 text-purple-100 hover:border-purple-500'}`}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => scrollInspirationPicker('left')}
                    className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/65 p-3 text-white shadow-xl transition hover:bg-purple-900/70 lg:inline-flex"
                    aria-label={t('studio.project.versions.previous')}
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollInspirationPicker('right')}
                    className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/65 p-3 text-white shadow-xl transition hover:bg-purple-900/70 lg:inline-flex"
                    aria-label={t('studio.project.versions.next')}
                  >
                    <FiChevronRight />
                  </button>

                  <div
                    ref={inspirationPickerRef}
                    className="flex max-h-[58vh] snap-x gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-3 pr-1"
                  >
                    {projectVersions.map((version: any, index: number) => {
                      const versionAudioUrl = version.audioUrl || version.streamAudioUrl
                      const duration = formatAudioDuration(version.duration)
                      const versionNumber = projectVersions.length - index
                      const isPreselected = preselectedInspirationVersionId === version.id

                      return (
                        <article
                          id={`inspiration-version-${version.id}`}
                          key={version.id}
                          className={`min-w-[82vw] snap-center rounded-3xl border p-4 shadow-xl shadow-black/30 sm:min-w-[26rem] lg:min-w-[30rem] ${isPreselected ? 'border-primary-300 bg-primary-950/20 ring-2 ring-primary-400/40' : 'border-purple-400/20 bg-black/35'}`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              {isPreselected && (
                                <p className="mb-1 text-xs font-black uppercase tracking-wide text-primary-200">{t('studio.project.versions.chosen')}</p>
                              )}
                              <p className="text-xs font-black uppercase tracking-wide text-green-300">{t('studio.project.versions.generatedSongNumber', { number: versionNumber })}</p>
                              <h3 className="mt-1 line-clamp-2 font-black text-white">
                                {version.versionName || version.style || t('studio.project.versions.generatedVersion')}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(version.createdAt).toLocaleString(i18n.language)}
                                {duration ? ` · ${t('studio.project.versions.duration', { duration })}` : ''}
                              </p>
                            </div>
                            {version.isCurrent && (
                              <span className="rounded-full bg-green-950 px-3 py-1 text-xs font-bold text-green-300">
                                {t('studio.project.versions.current')}
                              </span>
                            )}
                          </div>

                          {versionAudioUrl ? (
                            <StudioAudioPlayer src={versionAudioUrl} label={t('studio.project.versions.generatedSongNumber', { number: versionNumber })} />
                          ) : (
                            <p className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-500">{t('studio.project.versions.noAudio')}</p>
                          )}

                          <button
                            type="button"
                            onClick={() => reuseLyricInNewProject(version.id)}
                            disabled={Boolean(processing) || !canReuseLyric || !versionAudioUrl}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-black text-white transition hover:scale-[1.01] disabled:opacity-60"
                          >
                            {processing ? <FiLoader className="animate-spin" /> : <FiMusic />}
                            {t('studio.project.versions.useThisVersion')}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-500 lg:hidden">
                    {t('studio.project.versions.swipe')}
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {isMusicRequestPending ? (
            <PendingMusicRequestSummary
              project={project}
              projectId={projectId}
              message={message || musicGenerationBackgroundMessage}
              elapsedTime={formatGenerationTime(generationElapsedSeconds)}
              voicePreferences={voicePreferences}
              onRefresh={async () => {
                if (generationId) await checkGeneration(generationId)
                await loadProject({ silent: true, notifyReady: true, skipGenerationCheck: true })
              }}
            />
          ) : (
          <div className="grid w-full max-w-full gap-4">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-gray-950/85 shadow-2xl shadow-black/30 sm:rounded-[1.75rem]">
                <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#111827,#1f1235,#020617)] sm:aspect-square">
                  {projectCovers.length > 0 ? (
                    <>
                      <div ref={coverCarouselRef} className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth sm:hidden">
                        {projectCovers.map((cover: any, index: number) => (
                          <div key={cover.id || cover.imageUrl} className="relative h-full min-w-full snap-center">
                            <img src={cover.imageUrl} alt={t('studio.project.detail.coverAlt', { title: project.title, number: index + 1 })} className="h-full w-full object-cover" />
                            <div className="absolute left-3 top-3 flex gap-2">
                              {cover.isCurrent && <span className="rounded-full bg-green-600/90 px-3 py-1 text-[11px] font-black text-white">{t('studio.project.detail.coverPrimary')}</span>}
                              {cover.isPremium && <span className="rounded-full bg-purple-600/90 px-3 py-1 text-[11px] font-black text-white">{t('studio.project.detail.coverPro')}</span>}
                            </div>
                            <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">
                              {index + 1}/{projectCovers.length}
                            </span>
                            <div className="absolute inset-x-3 bottom-3 flex gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur">
                              {!cover.isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => manageProjectCover('select', cover.id)}
                                  disabled={Boolean(processing)}
                                  className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                                >
                                  Usar como principal
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => downloadCoverImage(cover.imageUrl)}
                                className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-xs font-bold text-white"
                              >
                                <FiDownload />
                              </button>
                              {projectCovers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => manageProjectCover('delete', cover.id)}
                                  disabled={Boolean(processing)}
                                  className="rounded-xl border border-red-500/40 bg-red-950/70 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-60"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {projectCovers.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => scrollCoverCarousel('left')}
                            aria-label={t('studio.project.detail.previousCover')}
                            className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur sm:hidden"
                          >
                            <FiChevronLeft />
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollCoverCarousel('right')}
                            aria-label={t('studio.project.detail.nextCover')}
                            className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl text-white shadow-lg backdrop-blur sm:hidden"
                          >
                            <FiChevronRight />
                          </button>
                          <div className="pointer-events-none absolute bottom-[5.6rem] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur sm:hidden">
                            Deslize para ver outras capas
                          </div>
                        </>
                      )}

                      <img
                        src={(projectCovers.find((cover: any) => cover.isCurrent) || projectCovers[0]).imageUrl}
                        alt={project.title}
                        className="hidden h-full w-full object-cover sm:block"
                      />
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-gray-400">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-purple-200">
                        <FiMusic className="h-10 w-10" />
                      </div>
                      <p className="mt-4 max-w-xs text-sm leading-relaxed">
                        {t('studio.project.cover.afterMusic')}
                      </p>
                    </div>
                  )}

                  {isGeneratingCover && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-8 text-center backdrop-blur-sm">
                      <FiLoader className="mb-4 h-12 w-12 animate-spin text-purple-300" />
                      <p className="text-xl font-black text-white">{t('studio.project.detail.generatingCover')}</p>
                      <p className="mt-2 text-sm text-gray-300">
                        {t('studio.project.cover.generating')}
                      </p>
                    </div>
                  )}
                </div>
                {projectCovers.length > 1 && (
                  <div className="hidden border-t border-white/10 bg-black/30 p-3 sm:block">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-wide text-purple-200">{t('studio.project.detail.yourCovers')}</p>
                      <p className="text-xs text-gray-500">{t('studio.project.detail.coverCount', { count: projectCovers.length })}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
                      {projectCovers.map((cover: any, index: number) => (
                        <div key={cover.id || cover.imageUrl} className={`overflow-hidden rounded-xl border ${cover.isCurrent ? 'border-green-400 ring-1 ring-green-400/40' : 'border-white/10'}`}>
                          <div className="relative aspect-square">
                            <img src={cover.imageUrl} alt={t('studio.project.detail.coverAlt', { title: project.title, number: index + 1 })} className="h-full w-full object-cover" />
                            {cover.isCurrent && <span className="absolute left-1.5 top-1.5 rounded-full bg-green-600 px-2 py-0.5 text-[9px] font-black text-white">{t('studio.project.detail.coverPrimary')}</span>}
                          </div>
                          <div className="grid gap-1 bg-gray-950 p-1.5">
                            {!cover.isCurrent && (
                              <button type="button" onClick={() => manageProjectCover('select', cover.id)} disabled={Boolean(processing)} className="rounded-lg bg-green-700 px-2 py-1.5 text-[10px] font-black text-white disabled:opacity-60">
                                Tornar principal
                              </button>
                            )}
                            <div className="grid grid-cols-2 gap-1">
                              <button type="button" onClick={() => downloadCoverImage(cover.imageUrl)} className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-bold text-gray-200">
                                Baixar
                              </button>
                              {projectCovers.length > 1 && (
                                <button type="button" onClick={() => manageProjectCover('delete', cover.id)} disabled={Boolean(processing)} className="rounded-lg border border-red-800 px-2 py-1.5 text-[10px] font-bold text-red-200 disabled:opacity-60">
                                  Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-purple-200">{t('studio.project.detail.songProject')}</p>
                      <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">{project.title}</h1>
                      <p className="mt-1 text-sm text-gray-400">{project.style || t('studio.project.detail.free')} · {project.mood || t('studio.project.detail.noMood')}</p>
                    </div>
                    <FiHeart className={`h-6 w-6 ${project.favorite ? 'fill-red-400 text-red-400' : 'text-gray-500'}`} />
                  </div>

                  <details className="mt-4 rounded-2xl border border-primary-300/15 bg-primary-950/15 p-3">
                    <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wide text-primary-200">
                      {t('studio.project.supportCode')}
                    </summary>
                    <p className="mt-3 break-all font-mono text-xs text-gray-200">
                      {projectId}
                    </p>
                    <div className="mt-3">
                      <CopyButton text={projectId} label={t('studio.project.detail.copyProjectCode')} />
                    </div>
                  </details>

                  <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-gray-400">
                      Detalhes do pedido
                    </summary>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-primary-400/20 bg-primary-950/50 px-3 py-1 font-semibold text-primary-100">{t('studio.project.detail.style')}: {project.style || t('studio.project.detail.free')}</span>
                      <span className="rounded-full border border-purple-400/20 bg-purple-950/50 px-3 py-1 font-semibold text-purple-100">{t('studio.project.detail.mood')}: {project.mood || t('studio.project.detail.free')}</span>
                      {project.structure && <span className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 font-semibold text-gray-200">{t('studio.project.detail.format')}: {project.structure}</span>}
                      {project.lineCount && <span className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 font-semibold text-gray-200">{t('studio.project.detail.length')}: {project.lineCount}</span>}
                      {voicePreferences && <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-950/50 px-3 py-1 font-semibold text-fuchsia-100">{t('studio.project.detail.voice')}: {voicePreferences}</span>}
                    </div>
                  </details>

                  {audioUrl && !shouldShowVersionList && (
                    <div className="mt-4">
                      <StudioAudioPlayer src={audioUrl} label={project.title || t('studio.project.detail.generatedSong')} />
                      <LearnYourMusicAd studioVersionId={currentStudioVersionId} studioProjectId={project.id} />
                    </div>
                  )}

                  {projectVersions.length > 1 && (
                    <div className="mt-5 rounded-2xl border border-green-900/50 bg-green-950/15 p-4">
                      <p className="text-sm font-bold text-green-100">
                        {t('studio.project.versionSummary', { count: projectVersions.length })}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {t('studio.project.versionHint')}
                      </p>
                    </div>
                  )}

                  {inspiration && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-yellow-500/50 bg-gradient-to-br from-yellow-950/35 via-purple-950/25 to-black p-4 sm:p-5">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-500/15 px-3 py-1 text-xs font-bold text-yellow-100">
                        <FiZap /> {t('studio.project.inspiration.using')}
                      </div>
                      <h2 className="text-lg font-black text-white">
                        {t('studio.project.detail.inspirationTitle', { title: inspiration.sourceTitle })}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-yellow-50/90">
                        {t('studio.project.detail.inspirationHint')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {inspiration.sourceStyle && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">{t('studio.project.detail.originalStyle', { value: inspiration.sourceStyle })}</span>}
                        {inspiration.sourceMood && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">{t('studio.project.detail.originalMood', { value: inspiration.sourceMood })}</span>}
                        {inspiration.variationLabel && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">{t('studio.project.detail.direction', { value: inspiration.variationLabel })}</span>}
                        <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">{t('studio.project.inspiration.ready')}</span>
                      </div>
                    </div>
                  )}

                  {shouldShowVersionList && (
                    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] sm:p-5">
                      <div className="mb-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-green-300">{t('studio.project.versions.ready')}</p>
                        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{t('studio.project.versions.chooseTitle')}</h2>
                        <p className="mt-1 text-sm text-gray-400">
                          {t('studio.project.versions.chooseDescription')}
                        </p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {projectVersions.map((version: any, index: number) => {
                          const versionAudioUrl = version.audioUrl || version.streamAudioUrl
                          const duration = formatAudioDuration(version.duration)
                          const versionNumber = projectVersions.length - index

                          return (
                            <article key={version.id} className={`rounded-2xl border p-3 sm:p-4 ${version.isCurrent ? 'border-green-500/50 bg-green-950/10' : 'border-gray-800 bg-black/35'}`}>
                              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-bold uppercase tracking-wide text-green-300">
                                      {t('studio.project.versions.versionNumber', { number: versionNumber })}
                                    </p>
                                    {version.isCurrent && (
                                      <span className="rounded-full bg-green-950 px-2.5 py-1 text-[11px] font-bold text-green-300">
                                        {t('studio.project.versions.current')}
                                      </span>
                                    )}
                                    {version.isPublished && (
                                      <span className="rounded-full bg-primary-950 px-2.5 py-1 text-[11px] font-bold text-primary-200">
                                        {t('studio.project.versions.published')}
                                      </span>
                                    )}
                                    {version.customVoice && (
                                      <span title={t('studio.project.versions.customVoiceTitle', { name: version.customVoice.name })} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
                                        <FiMic className="h-3 w-3" /> {t('studio.project.versions.voiceLabel', { name: version.customVoice.name })}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="mt-1 line-clamp-2 font-black text-white">
                                    {version.versionName || version.style || t('studio.project.versions.generatedSongNumber', { number: versionNumber })}
                                  </h3>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {new Date(version.createdAt).toLocaleString(i18n.language)}
                                    {duration ? ` · ${duration}` : ''}
                                  </p>
                                </div>
                              </div>
                              {versionAudioUrl ? (
                                <StudioAudioPlayer src={versionAudioUrl} label={t('studio.project.versions.versionNumber', { number: versionNumber })} />
                              ) : (
                                <p className="rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-4 text-sm text-cyan-100"><FiLoader className="mr-2 inline animate-spin" />{t('studio.project.versions.finalizingAudio')}</p>
                              )}
                              {versionAudioUrl && (
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                  <Link
                                    href={`/compositores/admin/studio-ia/playback?projectId=${encodeURIComponent(projectId)}&versionId=${encodeURIComponent(version.id)}`}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-primary-600 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.01] sm:w-auto"
                                  >
                                    <FiHeadphones /> {t('studio.project.versions.createPlayback')}
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => openInspirationPickerForVersion(version.id)}
                                    disabled={Boolean(processing) || !canReuseLyric}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-950/30 px-4 py-3 text-sm font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-900/40 disabled:opacity-60 sm:w-auto"
                                  >
                                    <FiMusic /> {t('studio.project.versions.createInspired')}
                                  </button>
                                </div>
                              )}
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-black text-white sm:text-2xl">{t('studio.project.lyrics.title')}</h2>
                        <p className="mt-1 text-xs text-gray-400">{t('studio.project.lyrics.description')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button onClick={saveLyric} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-gray-100 hover:bg-white/[0.09] sm:w-auto">
                          <FiSave /> {t('studio.project.lyrics.save')}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={lyric}
                      onChange={(event) => setLyric(event.target.value)}
                      rows={18}
                      className="w-full resize-none rounded-3xl border border-white/10 bg-[#05070d] px-4 py-4 text-sm leading-relaxed text-gray-100 shadow-inner shadow-black/50 outline-none transition [background-clip:padding-box] [transform:translateZ(0)] focus:border-primary-400 focus:bg-[#05070d] sm:resize-y"
                    />
                  </section>

                  {hasProjectReadyAudio && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-950/25 via-purple-950/25 to-black p-4">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/20 px-3 py-1 text-xs font-bold text-fuchsia-100">
                        <FiVideo /> {t('studio.project.video.title')}
                      </div>
                      <h2 className="text-lg font-black text-white">{t('studio.project.video.createTitle')}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">
                        {t('studio.project.video.description')}
                      </p>
                      {videoReadyVersions.length > 1 && (
                        <div className="mt-4">
                          <p className="text-sm font-bold text-white">{t('studio.project.video.whichVersion')}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {t('studio.project.video.chooseHint')}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[...videoReadyVersions]
                              .sort((a: any, b: any) => getStudioVersionNumber(projectVersions, a.id) - getStudioVersionNumber(projectVersions, b.id))
                              .map((version: any) => {
                              const versionNumber = getStudioVersionNumber(projectVersions, version.id)
                              const isSelected = version.id === resolvedVideoVersionId
                              return (
                                <button
                                  key={version.id}
                                  type="button"
                                  onClick={() => setSelectedVideoVersionId(version.id)}
                                  className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                                    isSelected
                                      ? 'border-fuchsia-300 bg-fuchsia-600 text-white'
                                      : 'border-fuchsia-800/70 bg-black/25 text-fuchsia-100 hover:border-fuchsia-500'
                                  }`}
                                >
                                  {t('studio.project.versions.versionNumber', { number: versionNumber })}
                                  {version.isCurrent ? ` · ${t('studio.project.versions.current')}` : ''}
                                </button>
                              )
                            })}
                          </div>
                          {selectedVideoAudioUrl && (
                            <div className="mt-3">
                              <StudioAudioPlayer
                                src={selectedVideoAudioUrl}
                                label={selectedVideoVersionNumber ? t('studio.project.versions.versionNumber', { number: selectedVideoVersionNumber }) : t('studio.project.versions.chosen')}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {!selectedVideoIsReady && (
                        <button
                          type="button"
                          onClick={() => setVideoCreditConfirmation({ replaceExisting: false })}
                          disabled={videoCheckoutLoading || hasActiveVideoRequest || !resolvedVideoVersionId}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-bold text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-70"
                        >
                          {videoCheckoutLoading ? (
                            <>
                              <FiLoader className="animate-spin" /> {t('studio.project.video.generating')}
                            </>
                          ) : selectedVideoIsActive || hasActiveVideoRequest ? (
                            <>
                              <FiClock /> {t('studio.project.video.alreadyRequested')}
                            </>
                          ) : (
                            <>
                              <FiVideo /> {selectedVideoVersionNumber ? t('studio.project.detail.videoVersionCredits', { number: selectedVideoVersionNumber }) : t('studio.project.detail.videoCredits')}
                            </>
                          )}
                        </button>
                      )}
                      {selectedVideoIsReady && canRegenerateSelectedVideo && (
                        <button
                          type="button"
                          onClick={() => setVideoCreditConfirmation({ replaceExisting: true })}
                          disabled={videoCheckoutLoading || hasActiveVideoRequest || !resolvedVideoVersionId}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-bold text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-70"
                        >
                          {videoCheckoutLoading ? (
                            <>
                              <FiLoader className="animate-spin" /> {t('studio.project.video.generatingNew')}
                            </>
                          ) : (
                            <>
                              <FiVideo /> {t('studio.project.video.regenerate')}
                            </>
                          )}
                        </button>
                      )}
                      {selectedVideoIsReady && canRegenerateSelectedVideo && (
                        <p className="mt-2 text-center text-xs text-purple-100/80">
                          {t('studio.project.video.courtesy')}
                        </p>
                      )}
                      {hasActiveVideoRequest && !selectedVideoIsReady && (
                        <p className="mt-2 text-center text-xs text-purple-100/80">
                          {selectedVideoIsActive
                            ? t('studio.project.detail.waitVideoVersion')
                            : t('studio.project.detail.waitVideoRequest')}
                        </p>
                      )}
                    </div>
                  )}

                  {allVideoRequests.length > 0 && (
                    <div className="mt-4 space-y-4">
                      <h2 className="text-lg font-black text-white">{t('studio.project.video.yourVideos')}</h2>
                      {allVideoRequests.map((video: any) => {
                        const versionNumber = getStudioVersionNumber(projectVersions, video.versionId)
                        const versionLabel = video.versionName
                          || (versionNumber > 0 ? t('studio.project.versions.versionNumber', { number: versionNumber }) : t('studio.project.detail.unknownVersion'))
                        const status = videoRequestStatus.has(video.status) ? video.status : 'requested'
                        const videoUrl = video.videoUrl || null
                        return (
                          <article key={video.id} className="rounded-2xl border border-purple-700/60 bg-purple-950/25 p-4 sm:p-5">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="mb-1 inline-flex items-center gap-2 text-sm font-bold text-purple-100">
                                  {video.status === 'completed' ? <FiCheckCircle className="text-green-300" /> : <FiClock className="text-purple-300" />}
                                  {versionLabel}
                                </div>
                                <p className="text-sm text-purple-100/90">{t(`studio.project.video.status.${status}.description`)}</p>
                                <p className="mt-2 text-xs text-purple-200/70">
                                  {t('studio.project.video.requestedAt', { date: new Date(video.createdAt || video.completedAt).toLocaleString(i18n.language) })}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-purple-500/50 bg-black/30 px-3 py-1 text-xs font-bold text-purple-100">
                                  {t(`studio.project.video.status.${status}.label`)}
                                </span>
                                {videoUrl && (
                                  <a
                                    href={videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-fuchsia-100 hover:bg-gray-700"
                                  >
                                    <FiDownload /> {t('studio.project.video.download')}
                                  </a>
                                )}
                              </div>
                            </div>
                            {videoUrl ? (
                              <div className="max-w-[220px]">
                                <div className="overflow-hidden rounded-xl border border-gray-800 bg-black">
                                  <video
                                    controls
                                    playsInline
                                    preload="metadata"
                                    src={videoUrl}
                                    className="h-[280px] w-full object-contain"
                                  >
                                    {t('studio.project.video.browserUnsupported')}
                                  </video>
                                </div>
                                <p className="mt-2 text-xs text-purple-200/70">
                                  {t('studio.project.video.previewHint')}
                                </p>
                              </div>
                            ) : (
                              video.errorMessage && (
                                <p className="text-xs text-red-200">
                                  {t('studio.project.video.detail', { detail: video.errorMessage })}
                                </p>
                              )
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )}

                  {hasProjectReadyAudio && (
                    <div className="mt-4">
                      <LearnYourMusicAd studioVersionId={currentStudioVersionId} studioProjectId={project.id} />
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 rounded-3xl border border-purple-300/15 bg-gradient-to-br from-purple-950/30 via-gray-950 to-black p-3">
                    <div>
                      <p className="text-sm font-black text-white">{t('studio.project.actions.title')}</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        {t('studio.project.actions.description')}
                      </p>
                    </div>
                    {!audioUrl && voices.length > 0 && (
                      <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-purple-100" htmlFor="project-voice-profile">
                          <FiMic /> {t('studio.project.voice.useSaved')}
                        </label>
                        <div id="project-voice-profile" className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => handleVoiceSelection('')}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${!selectedVoiceId ? 'border-primary-400 bg-primary-950/50 text-white' : 'border-purple-800/70 bg-gray-950 text-purple-100 hover:border-purple-500'}`}
                          >
                            {t('studio.project.voice.none')}
                          </button>
                          {voices.map((voice) => (
                            <button
                              key={voice.id}
                              type="button"
                              onClick={() => handleVoiceSelection(voice.id)}
                              disabled={invalidVoiceIds.includes(voice.id)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${invalidVoiceIds.includes(voice.id) ? 'cursor-not-allowed border-red-800/70 bg-red-950/30 text-red-200' : selectedVoiceId === voice.id ? 'border-primary-400 bg-primary-950/50 text-white' : 'border-purple-800/70 bg-gray-950 text-purple-100 hover:border-purple-500'}`}
                            >
                              {voice.displayName}{invalidVoiceIds.includes(voice.id) ? ` — ${t('studio.project.voice.unavailable')}` : ''}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-purple-100/80">
                          {t('studio.project.voice.hint')}
                        </p>
                      </div>
                    )}
                    {!audioUrl && selectedVoiceId && voices.length === 0 && (
                      <div className="rounded-2xl border border-purple-800/60 bg-purple-950/20 p-4">
                        <p className="flex items-center gap-2 text-sm font-bold text-purple-100">
                          <FiMic /> {t('studio.project.voice.selected')}
                        </p>
                        <p className="mt-2 text-xs text-purple-100/80">
                          {t('studio.project.voice.selectedHint')}
                        </p>
                      </div>
                    )}
                    {!audioUrl && (
                      <button onClick={createMusic} disabled={Boolean(processing) || !canCreateMusic || Boolean(selectedVoiceId && invalidVoiceIds.includes(selectedVoiceId))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 via-purple-500 to-fuchsia-500 px-4 py-3.5 font-black text-white shadow-lg shadow-purple-950/40 transition hover:from-primary-400 hover:via-purple-400 hover:to-fuchsia-400 disabled:opacity-60">
                        <FiMusic /> {t('studio.project.actions.createNow')}
                      </button>
                    )}
                    {canRetryEnhance && (
                      <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-4">
                        <p className="text-sm font-bold text-emerald-100">{t('studio.project.actions.originalAudioSaved')}</p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                          {t('studio.project.actions.retryOriginalDescription')}
                        </p>
                        <button
                          type="button"
                          onClick={retryEnhanceFromOriginal}
                          disabled={Boolean(processing) || !canCreateMusic || !lyric.trim()}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-900/40 px-4 py-3 text-sm font-black text-emerald-50 transition hover:border-emerald-300 hover:bg-emerald-800/50 disabled:opacity-60"
                        >
                          <FiZap /> {t('studio.project.actions.retryOriginal')}
                        </button>
                      </div>
                    )}
                    {audioUrl && (
                      <>
                      <div className="flex items-center gap-2">
                        <button onClick={improveCover} disabled={Boolean(processing) || !canGeneratePremiumCover} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100 transition hover:border-purple-400/40 hover:bg-white/[0.09] disabled:opacity-60">
                          {isGeneratingCover ? (
                            <>
                              <FiLoader className="animate-spin" /> Gerando capa...
                            </>
                          ) : (
                            <>
                              <FiZap /> Criar capa profissional
                            </>
                          )}
                        </button>
                        <div className="group relative">
                          <button
                            type="button"
                            aria-label={t('studio.project.detail.coverInfo')}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gray-900 text-sm font-black text-gray-300 hover:border-purple-500 hover:text-white"
                          >
                            ?
                          </button>
                          <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-xl border border-purple-700/60 bg-gray-950 px-4 py-3 text-xs leading-relaxed text-purple-100 shadow-xl shadow-black/40 group-hover:block">
                            {t('studio.project.cover.professionalHint')}
                          </div>
                        </div>
                      </div>
                      {!studioStatus ? (
                        <p className="text-center text-xs text-gray-500">
                          {t('studio.project.cover.loadingPermissions')}
                        </p>
                      ) : (
                        premiumCoverLimit > 0 && <p className="text-center text-xs text-gray-500">
                          {t('studio.project.detail.premiumCoverUsage', { used: premiumCoverGenerations, limit: premiumCoverLimit })}
                        </p>
                      )}
                      {project.status === 'published' ? (
                        <button onClick={unpublishProject} disabled={Boolean(processing)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-950/30 px-4 py-3 font-bold text-yellow-100 transition hover:bg-yellow-900/40 disabled:opacity-60">
                          <FiEyeOff /> {t('studio.project.publish.unpublish')}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={publishProject}
                            disabled={Boolean(processing) || !studioStatus}
                            title={!canPublishOnDcc ? publishPlanRequiredMessage : undefined}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white transition disabled:opacity-60 ${
                              canPublishOnDcc
                                ? 'bg-green-700 hover:bg-green-600'
                                : 'bg-green-900/70 ring-1 ring-amber-400/40 hover:bg-green-800/80'
                            }`}
                          >
                            {canPublishOnDcc ? <FiZap /> : <FiLock />}
                            {t('studio.project.publish.publish')}
                          </button>
                          <div className="group relative">
                            <button
                              type="button"
                              aria-label={t('studio.project.detail.publishInfo')}
                              onClick={() => setShowPublishPlanModal(true)}
                              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gray-900 text-sm font-black text-gray-300 hover:border-amber-500 hover:text-white"
                            >
                              ?
                            </button>
                            <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-xl border border-amber-500/50 bg-gray-950 px-4 py-3 text-xs leading-relaxed text-amber-50 shadow-xl shadow-black/40 group-hover:block">
                              <p className="font-bold text-amber-200">{t('studio.project.detail.aboutPublish')}</p>
                              <p className="mt-1.5">{publishPlanRequiredMessage}</p>
                            </div>
                          </div>
                        </div>
                      )}
                        </>
                    )}
                    {project.status === 'published' && project.publicSlug && (
                      <Link href={`/studio/${project.publicSlug}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100">
                        <FiExternalLink /> {t('studio.project.publish.viewPublic')}
                      </Link>
                    )}
                    {project.cover?.imageUrl && (
                      <button type="button" onClick={() => downloadCoverImage()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100">
                        <FiDownload /> Baixar capa
                      </button>
                    )}
                    {audioUrl && (
                      <a href={audioUrl} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100">
                        <FiDownload /> Baixar MP3
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <main className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">
                  <p>{error}</p>
                </div>
              )}
              {visibleMessage && (
                <div
                  ref={visibleMessage === musicGenerationBackgroundMessage ? backgroundMessageRef : undefined}
                  tabIndex={visibleMessage === musicGenerationBackgroundMessage ? -1 : undefined}
                  className="rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200 outline-none ring-green-500/40 focus:ring-2"
                >
                  {visibleMessage}
                </div>
              )}

              <details className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 sm:rounded-[1.75rem] sm:p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-white">{t('studio.project.detail.refineTitle')}</h2>
                      <p className="mt-1 text-xs text-gray-400">
                        {t('studio.project.detail.refineHint')}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-gray-300">
                      opcional
                    </span>
                  </div>
                </summary>

                <div className="mt-4 space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-bold text-white">{t('studio.project.detail.refineLyrics')}</p>
                    <div className="flex flex-wrap gap-2">
                      {refineActions.map((action) => (
                        <button
                          key={action}
                          onClick={() => refineLyric(action)}
                          disabled={Boolean(processing)}
                          className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-primary-400/60 hover:bg-primary-950/30 disabled:opacity-60"
                        >
                          {t(`studio.project.refine.actions.${action}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                    <label className="block text-sm font-bold text-purple-100" htmlFor="studio-extra-instructions">
                      {t('studio.project.instructions.title')}
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-purple-100/70">
                      {t('studio.project.instructions.hint')}
                    </p>
                    <textarea
                      id="studio-extra-instructions"
                      value={extraInstructions}
                      onChange={(event) => handleExtraInstructionsChange(event.target.value)}
                      rows={4}
                      maxLength={700}
                      placeholder={t('studio.project.detail.extraPlaceholder')}
                      className="mt-3 w-full resize-none rounded-2xl border border-purple-300/20 bg-gray-950 px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-primary-400"
                    />
                    <p className="mt-2 text-right text-[11px] text-gray-500">
                      {extraInstructions.length}/700
                    </p>
                  </div>
                </div>
              </details>

              <section className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 sm:rounded-[1.75rem] sm:p-5">
                <h2 className="mb-2 text-lg font-black text-white">{t('studio.project.detail.shareLink')}</h2>
                <p className="mb-4 text-sm leading-relaxed text-gray-400">
                  {t('studio.project.publish.afterPublish')}
                </p>
                {project.publicSlug ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setShowIncorporateCode((current) => !current)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 font-bold text-white transition hover:bg-primary-700"
                    >
                      <FiCode />
                      Colocar em outro site
                    </button>

                    {showIncorporateCode && (
                      <div className="rounded-2xl border border-primary-900/60 bg-gray-900 p-4">
                        <p className="mb-3 text-sm text-gray-300">
                          {t('studio.project.detail.embedHint')}
                        </p>
                        <textarea
                          readOnly
                          value={incorporateCode}
                          rows={4}
                          className="w-full resize-none rounded-xl border border-gray-700 bg-black/60 p-3 font-mono text-xs text-gray-200 outline-none"
                        />
                        <div className="mt-3">
                          <CopyButton text={incorporateCode} label={t('studio.project.detail.copyCode')} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-gray-400">
                    {t('studio.project.publish.embedHint')}
                  </p>
                )}
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-3 sm:rounded-[1.75rem] sm:p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0">
                  {[
                    {
                      title: t('studio.project.detail.aiGenerated'),
                      subtitle: t('studio.project.detail.advancedTechnology'),
                      Icon: FiZap,
                      color: 'text-orange-400',
                      glow: 'bg-orange-500/15 shadow-[0_0_24px_rgba(251,146,60,0.35)]',
                    },
                    {
                      title: t('studio.project.detail.yourRights'),
                      subtitle: t('studio.project.detail.guaranteedRights'),
                      Icon: FiShield,
                      color: 'text-emerald-400',
                      glow: 'bg-emerald-500/15 shadow-[0_0_24px_rgba(52,211,153,0.35)]',
                    },
                    {
                      title: t('studio.project.detail.highQuality'),
                      subtitle: t('studio.project.detail.professionalAudio'),
                      Icon: FiCloud,
                      color: 'text-sky-400',
                      glow: 'bg-sky-500/15 shadow-[0_0_24px_rgba(56,189,248,0.35)]',
                    },
                    {
                      title: t('studio.project.detail.yourProjects'),
                      subtitle: t('studio.project.detail.alwaysSaved'),
                      Icon: FiLock,
                      color: 'text-amber-300',
                      glow: 'bg-amber-400/15 shadow-[0_0_24px_rgba(251,191,36,0.35)]',
                    },
                  ].map((item, index) => (
                    <div
                      key={item.title}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 xl:rounded-none xl:px-3 ${
                        index < 3 ? 'xl:border-r xl:border-white/10' : ''
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.glow}`}>
                        <item.Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-black leading-snug text-white">{item.title}</p>
                        <p className="text-xs leading-snug text-gray-400">{item.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </main>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PendingMusicRequestSummary({
  project,
  projectId,
  message,
  elapsedTime,
  voicePreferences,
  onRefresh,
}: {
  project: any
  projectId: string
  message: string
  elapsedTime: string
  voicePreferences?: string
  onRefresh: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const summaryItems = [
    [t('studio.project.detail.name'), project.title || t('studio.project.detail.yourSong')],
    [t('studio.project.detail.style'), project.style || t('studio.project.detail.free')],
    [t('studio.project.detail.mood'), project.mood || t('studio.project.detail.free')],
    [t('studio.project.detail.format'), project.structure || t('studio.project.detail.free')],
    [t('studio.project.detail.length'), project.lineCount || t('studio.project.detail.notProvided')],
    [t('studio.project.detail.voice'), voicePreferences || t('studio.project.detail.aiChooses')],
  ].filter(([, value]) => Boolean(value))

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      headingRef.current?.focus({ preventScroll: true })
    }, 50)
  }, [])

  return (
    <div className="mx-auto w-full max-w-full sm:max-w-4xl">
      <div className="w-full overflow-hidden rounded-[2rem] border border-purple-500/30 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_36%),linear-gradient(135deg,#050816,#090b16,#160728)] shadow-2xl shadow-purple-950/40">
        <div className="border-b border-white/10 p-5 sm:p-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-green-200">
            <FiClock /> Pedido recebido
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-black text-white outline-none sm:text-4xl">
            {t('studio.project.processing.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            {message}
          </p>
          <div className="mt-5 flex max-w-full flex-wrap gap-3">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/35 px-4 py-2 text-sm font-bold text-purple-100">
              <FiLoader className="animate-spin" />
              Gerando em segundo plano
            </div>
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-bold text-gray-200">
              {t('studio.project.detail.elapsed')}: <span className="font-mono text-white">{elapsedTime}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-black text-white">{t('studio.project.detail.requestSummary')}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {summaryItems.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-gray-950/70 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-gray-100">{value}</p>
                </div>
              ))}
            </div>
            {project.description && (
              <div className="mt-3 rounded-2xl border border-purple-400/20 bg-purple-950/20 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-purple-200">{t('studio.project.detail.submittedIdea')}</p>
                <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-relaxed text-purple-50/90">
                  {project.description}
                </p>
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-green-400/20 bg-green-950/10 p-4 sm:p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-400/30 bg-green-500/10 text-green-200">
              <FiCheckCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-black text-white">{t('studio.project.detail.whatNext')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {t('studio.project.processing.noRepeat')}
              {t('studio.project.processing.autoUpdate')}
            </p>
            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-relaxed text-gray-300">
              <p><strong className="text-white">{t('studio.project.detail.projectCode')}:</strong> {projectId}</p>
              <p>{t('studio.project.detail.returnLater')}</p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-500 disabled:opacity-60"
              >
                {refreshing ? <FiLoader className="animate-spin" /> : <FiClock />}
                Atualizar status
              </button>
              <Link
                href="/compositores/admin/studio-ia/projetos"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-gray-100 hover:bg-white/[0.09]"
              >
                <FiArrowLeft />
                Meus Projetos
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function StudioProcessing({
  message,
  description,
  elapsedTime,
  previewAudioUrl,
  onClose,
}: {
  message: string
  description?: string
  elapsedTime?: string
  previewAudioUrl?: string
  onClose?: () => void
}) {
  const { t } = useTranslation()
  const isCover = [t('studio.project.cover.generating'), t('studio.project.detail.selectingCover'), t('studio.project.detail.deletingCover')].includes(message)
  const steps = isCover
    ? [1, 2, 3, 4].map((index) => t(`studio.project.detail.coverSteps.${index}`))
    : [1, 2, 3, 4, 5].map((index) => t(`studio.project.detail.musicSteps.${index}`))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur sm:items-center sm:px-4"
    >
      <div className="relative w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-primary-700/60 bg-gray-950 p-5 text-center shadow-2xl shadow-purple-950/60 sm:max-w-lg sm:rounded-3xl sm:p-8">
        <div className="absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('studio.project.detail.closeTracking')}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-black/50 text-gray-300 transition hover:border-purple-400 hover:text-white"
          >
            <FiX className="h-5 w-5" />
          </button>
        )}
        <FiLoader className="relative mx-auto mb-4 h-10 w-10 animate-spin text-primary-300 sm:mb-5 sm:h-12 sm:w-12" />
        <h2 className="relative mb-2 text-xl font-black leading-tight sm:text-2xl">{message}</h2>
        {description && (
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-300">
            {description}
          </p>
        )}
        {elapsedTime && (
          <div className="relative mx-auto mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-purple-500/50 bg-purple-950/40 px-3 py-2 text-sm font-bold text-purple-100 sm:mt-5 sm:px-4">
            <span>{t('studio.project.detail.elapsed')}</span>
            <span className="font-mono text-white">{elapsedTime}</span>
          </div>
        )}
        {onClose && (
          <p className="relative mx-auto mt-4 max-w-sm rounded-2xl border border-purple-700/50 bg-purple-950/30 px-3 py-3 text-xs leading-relaxed text-purple-100 sm:px-4">
            {t('studio.project.processing.closeHint')}
          </p>
        )}
        {previewAudioUrl && (
          <div className="relative mt-5 rounded-2xl border border-green-700/60 bg-green-950/30 p-4 text-left">
            <p className="mb-3 text-sm font-bold text-green-100">{t('studio.project.processing.preview')}</p>
            <StudioAudioPlayer src={previewAudioUrl} label={t('studio.project.detail.musicPreview')} />
          </div>
        )}
        <div className="relative mt-5 space-y-2 text-left sm:mt-6 sm:space-y-3">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-xl bg-gray-900/70 px-3 py-2.5 text-sm sm:px-4 sm:py-3">
              <span className={index === steps.length - 1 ? 'text-primary-300' : 'text-green-400'}>
                {index === steps.length - 1 ? '⏳' : '✔'}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation()
  const hasNoBalance = message === t('studio.project.generation.noCredits') || message === t('studio.project.generation.retryNeedsCredits') || message === t('studio.project.generation.reuseNoCredits')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4 backdrop-blur"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-purple-600/70 bg-gradient-to-br from-gray-950 via-purple-950/70 to-black p-7 text-center shadow-2xl shadow-purple-950/60"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600/20 text-purple-200">
          <FiZap className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black text-white">{hasNoBalance ? t('studio.project.upgrade.noBalance') : t('studio.project.upgrade.title')}</h2>
        <p className="mt-3 text-sm text-purple-100/90">{message}</p>
        <p className="mt-3 text-sm text-gray-300">
          {t('studio.project.upgrade.description')}
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/studio-ia#planos"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
          >
            {t('studio.project.upgrade.viewPlans')}
          </Link>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center justify-center rounded-xl border border-purple-600 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/50"
          >
            {t('studio.project.upgrade.buyTopup')}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 px-5 py-3 font-bold text-gray-200 hover:bg-gray-900"
          >
            {t('common.actions.cancel')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function PublishPlanModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-amber-500/50 bg-gradient-to-br from-gray-950 via-amber-950/40 to-black p-7 text-center shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <FiLock className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black text-white">{t('studio.project.detail.planRequiredTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-50/90">
          {message}
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-gray-300">
          <p><span className="font-semibold text-white">{t('studio.project.detail.topupLabel')}:</span> {t('studio.project.detail.topupPurpose')}</p>
          <p className="mt-1"><span className="font-semibold text-white">{t('studio.project.detail.activePlanLabel')}:</span> {t('studio.project.detail.activePlanPurpose')}</p>
        </div>
        <div className="mt-6 grid gap-3">
          <Link
            href="/studio-ia#planos"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
          >
            Ver planos do Studio IA
          </Link>
          <Link
            href="/compositores/planos#compositor-premium"
            className="inline-flex items-center justify-center rounded-xl border border-amber-500/50 px-5 py-3 font-bold text-amber-100 hover:bg-amber-950/40"
          >
            Ver Compositor Premium
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 px-5 py-3 font-bold text-gray-200 hover:bg-gray-900"
          >
            Entendi
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
