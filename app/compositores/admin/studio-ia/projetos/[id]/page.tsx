'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FiArrowLeft, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiCode, FiCreditCard, FiDownload, FiExternalLink, FiEyeOff, FiHeart, FiLoader, FiMic, FiMusic, FiPause, FiPlay, FiSave, FiVideo, FiX, FiZap } from 'react-icons/fi'
import CopyButton from '@/components/CopyButton'

const refineActions = [
  ['improve_chorus', 'melhorar refrão'],
  ['sticky', 'deixar mais chiclete'],
  ['sadder', 'deixar mais sofrida'],
  ['modern', 'deixar mais moderna'],
  ['romantic', 'deixar mais romântica'],
  ['commercial', 'deixar mais comercial'],
]

const musicGenerationMessages = [
  'Estamos criando sua música...',
  'Transformando a letra em melodia...',
  'A produção está ganhando forma...',
  'Ajustando voz, clima e instrumental...',
  'Está ficando maravilhoso...',
  'Finalizando os detalhes da música...',
  'Quase pronto, preparando o resultado...',
]

const MUSIC_GENERATION_TIMEOUT_SECONDS = 15 * 60
const MUSIC_GENERATION_BACKGROUND_SECONDS = 20
const MUSIC_GENERATION_BACKGROUND_MESSAGE = 'Recebemos sua solicitação. Assim que a música estiver pronta, te mandamos um e-mail. Você também pode aguardar por aqui mesmo. Sinto que está vindo um sucesso!'
const MUSIC_CREATION_UNAVAILABLE_MESSAGE = 'Sua letra foi salva, mas não conseguimos iniciar a criação da música agora. Tente novamente mais tarde.'
const STUDIO_MUSIC_CREDITS = 10

const inspirationVariationOptions = [
  { id: 'similar', label: 'Manter parecido' },
  { id: 'faster', label: 'Um pouco mais rápido' },
  { id: 'energetic', label: 'Mais animado' },
  { id: 'slower_romantic', label: 'Mais lento/romântico' },
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

function StudioAudioPlayer({ src, label = 'Ouvir música' }: { src: string; label?: string }) {
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
      link.download = sanitizeDownloadName(label)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
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
          aria-label={isPlaying ? 'Pausar música' : 'Tocar música'}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{label}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-10 text-xs text-gray-400">{formatGenerationTime(Math.floor(currentTime))}</span>
            <div
              ref={progressRef}
              role="slider"
              aria-label="Progresso da música"
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
          aria-label="Baixar música"
        >
          {downloading ? <FiLoader className="animate-spin" /> : <FiDownload />}
        </button>
      </div>
    </div>
  )
}

function extractVoicePreferences(description?: string | null) {
  const match = String(description || '').match(/Preferência de voz:\s*(.+)/i)
  return match?.[1]?.trim() || ''
}

const videoRequestStatus: Record<string, { label: string; description: string }> = {
  payment_pending: {
    label: 'Aguardando confirmação',
    description: 'A solicitação foi registrada e será enviada para produção.',
  },
  requested: {
    label: 'Solicitado',
    description: 'Recebemos sua solicitação. O vídeo com letra será enviado para produção.',
  },
  in_production: {
    label: 'Em produção',
    description: 'Seu vídeo com capa, nome e letra está sendo produzido. Assim que finalizar, o link aparecerá aqui.',
  },
  completed: {
    label: 'Concluído',
    description: 'Seu vídeo com letra foi finalizado.',
  },
  cancelled: {
    label: 'Cancelado',
    description: 'Esta solicitação foi cancelada.',
  },
  failed: {
    label: 'Não confirmado',
    description: 'Não conseguimos confirmar esta solicitação. Entre em contato com o suporte se necessário.',
  },
}

export default function StudioProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = String(params.id)
  const [project, setProject] = useState<any>(null)
  const [lyric, setLyric] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState('')
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0)
  const [generationBackgroundMode, setGenerationBackgroundMode] = useState(false)
  const [previewAudioUrl, setPreviewAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [studioStatus, setStudioStatus] = useState<any>(null)
  const [voices, setVoices] = useState<any[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [extraInstructions, setExtraInstructions] = useState('')
  const [selectedInspirationVariation, setSelectedInspirationVariation] = useState('similar')
  const [videoCheckoutLoading, setVideoCheckoutLoading] = useState(false)
  const [upgradeModalMessage, setUpgradeModalMessage] = useState('')
  const [showIncorporateCode, setShowIncorporateCode] = useState(false)
  const [showInspirationPicker, setShowInspirationPicker] = useState(false)
  const backgroundMessageRef = useRef<HTMLDivElement | null>(null)
  const inspirationPickerRef = useRef<HTMLDivElement | null>(null)
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
    if (message !== MUSIC_GENERATION_BACKGROUND_MESSAGE || lastFocusedMessageRef.current === message) return

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
      setGenerationElapsedSeconds((currentSeconds) => {
        const nextSeconds = currentSeconds + 1
        if (nextSeconds >= MUSIC_GENERATION_TIMEOUT_SECONDS) {
          setGenerationId(null)
          setPreviewAudioUrl('')
          setGenerationBackgroundMode(false)
          setMessage('Está demorando mais que o normal, mas fique tranquilo: a música será criada. Você pode fechar esta tela ou tomar um cafezinho; em breve ela estará disponível em Meus Projetos.')
        } else if (nextSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS) {
          setGenerationBackgroundMode(true)
          setMessage(MUSIC_GENERATION_BACKGROUND_MESSAGE)
        }
        return nextSeconds
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [generationId])

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
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar projeto')
      const projectAudioUrl = data.project.version?.audioUrl || data.project.version?.streamAudioUrl
      setProject(data.project)
      setLyric(data.project.lyric || '')
      if (projectAudioUrl) {
        setGenerationId(null)
        setGenerationBackgroundMode(false)
        setPreviewAudioUrl('')
        if (options?.notifyReady) {
          setMessage('Sua música ficou pronta. Atualizamos esta página automaticamente.')
        }
      } else if (data.activeGeneration?.id) {
        setGenerationId(data.activeGeneration.id)
        const createdAt = new Date(data.activeGeneration.createdAt).getTime()
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
        setGenerationElapsedSeconds(Math.min(elapsedSeconds, MUSIC_GENERATION_TIMEOUT_SECONDS - 60))
        setGenerationBackgroundMode(elapsedSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS)
        if (elapsedSeconds >= MUSIC_GENERATION_BACKGROUND_SECONDS) {
          setMessage(MUSIC_GENERATION_BACKGROUND_MESSAGE)
        }
        if (!options?.skipGenerationCheck) {
          checkGeneration(data.activeGeneration.id)
        }
      }

      await refreshStudioStatus(token)

      return data
    } catch (err: any) {
      if (!options?.suppressError) {
        setError(err.message || 'Erro ao carregar projeto')
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
    setProcessing('Salvando letra...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar letra')
      setMessage('Letra salva com sucesso.')
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar letra')
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
    setProcessing('Reescrevendo letra...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao melhorar letra')
      setLyric(data.lyric)
      setMessage('Letra atualizada.')
    } catch (err: any) {
      setError(err.message || 'Erro ao melhorar letra')
    } finally {
      setProcessing('')
    }
  }

  const createMusic = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    const latestStudioStatus = await refreshStudioStatus(token)
    if (!latestStudioStatus?.canCreateMusic) {
      const upgradeMessage = 'Você já usou sua música grátis ou está sem saldo. Assine um plano DCC Studio IA ou faça uma recarga avulsa para criar novas músicas.'
      setError('')
      setUpgradeModalMessage(upgradeMessage)
      return
    }

    setProcessing('Criando música...')
    try {
      setError('')
      setMessage('')
      await saveLyric()
      setProcessing('Criando música...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao criar música')
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
        setMessage(MUSIC_GENERATION_BACKGROUND_MESSAGE)
        return
      }

      const rawErrorMessage = err.message || 'Erro ao criar música'
      const errorMessage = rawErrorMessage.toLowerCase().includes('fetch failed')
        ? MUSIC_CREATION_UNAVAILABLE_MESSAGE
        : rawErrorMessage
      setError(errorMessage)
      if (errorMessage.toLowerCase().includes('música grátis') || errorMessage.toLowerCase().includes('assine um plano')) {
        setUpgradeModalMessage(errorMessage)
      }
    } finally {
      setProcessing('')
    }
  }

  const reuseLyricInNewProject = async (sourceVersionId?: string) => {
    setShowInspirationPicker(false)
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    const latestStudioStatus = await refreshStudioStatus(token)
    if (!latestStudioStatus?.canCreateMusic) {
      const upgradeMessage = 'Você já usou sua música grátis ou está sem saldo. Assine um plano DCC Studio IA ou faça uma recarga avulsa para reaproveitar letras e criar novas versões.'
      setError('')
      setUpgradeModalMessage(upgradeMessage)
      return
    }

    if (!lyric.trim()) {
      setError('Não há letra para reaproveitar.')
      return
    }

    setProcessing('Criando novo projeto...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao criar novo projeto')

      router.push(`/compositores/admin/studio-ia/projetos/${data.project.id}`)
    } catch (err: any) {
      setError(err.message || 'Erro ao reaproveitar letra')
      setProcessing('')
    }
  }

  const scrollInspirationPicker = (direction: 'left' | 'right') => {
    inspirationPickerRef.current?.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    })
  }

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
      setError(data.error || 'Não consegui consultar a geração da música agora.')
      return
    }

    if (data.generation?.status === 'failed') {
      setGenerationId(null)
      setPreviewAudioUrl('')
      setError(data.generation?.error_message || 'Não conseguimos confirmar essa geração agora. Se ela já foi criada, ela pode aparecer em Meus Projetos assim que a sincronização terminar.')
      return
    }

    if (data.version?.streamAudioUrl && !data.version?.audioUrl) {
      setPreviewAudioUrl(data.version.streamAudioUrl)
    }

    if (data.awaitingAudioSync) {
      setGenerationBackgroundMode(true)
      setMessage('A música já foi criada. Estamos sincronizando o áudio no DCC Music e você pode continuar usando a página.')
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
      setMessage('Sua música ficou pronta. Atualizamos esta página automaticamente.')
    }
  }

  const closeGenerationModal = async () => {
    const currentGenerationId = generationId
    setGenerationBackgroundMode(true)
    setMessage(MUSIC_GENERATION_BACKGROUND_MESSAGE)

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
      setError('A capa profissional está disponível a partir do Studio Pro.')
      return
    }

    setProcessing('Gerando capa profissional...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao melhorar capa')
      setProject((currentProject: any) => ({ ...currentProject, cover: data.cover }))
      setStudioStatus((currentStatus: any) => currentStatus ? ({
        ...currentStatus,
        stats: {
          ...currentStatus.stats,
          premiumCoverGenerations: (currentStatus.stats?.premiumCoverGenerations || 0) + 1,
        },
      }) : currentStatus)
      setMessage('Capa profissional criada.')
    } catch (err: any) {
      setError(err.message || 'Erro ao melhorar capa')
    } finally {
      setProcessing('')
    }
  }

  const publishProject = async () => {
    const token = localStorage.getItem('composer_token')
    setError('')
    setMessage('')

    if (!studioStatus?.canPublish) {
      setError('Para publicar no DCC Music, é necessário ter plano Studio IA ou ser Compositor Premium ativo.')
      return
    }

    setProcessing('Publicando no DCC Music...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao publicar')
      setProject((currentProject: any) => ({ ...currentProject, status: 'published', publicSlug: data.publicSlug }))
      setMessage('Música publicada no DCC Music.')
    } catch (err: any) {
      setError(err.message || 'Erro ao publicar')
    } finally {
      setProcessing('')
    }
  }

  const unpublishProject = async () => {
    const token = localStorage.getItem('composer_token')
    setError('')
    setMessage('')

    if (!window.confirm('Quer mesmo despublicar esta música? A página pública sairá do ar, mas o projeto, a letra, a capa e o áudio continuarão salvos.')) {
      return
    }

    setProcessing('Despublicando música...')
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
      if (!response.ok) throw new Error(data.error || 'Erro ao despublicar')
      setProject((currentProject: any) => ({
        ...currentProject,
        status: 'ready',
        publicSlug: null,
      }))
      setMessage('Música despublicada. Ela saiu da página pública, mas continua salva no seu projeto.')
    } catch (err: any) {
      setError(err.message || 'Erro ao despublicar')
    } finally {
      setProcessing('')
    }
  }

  const downloadCoverImage = async () => {
    const coverUrl = project?.cover?.imageUrl
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

  const requestVideoClip = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push(`/compositores/login?redirect=${encodeURIComponent(`/compositores/admin/studio-ia/projetos/${projectId}`)}`)
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
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar vídeo com letra')

      if (data.videoRequest) {
        setProject((currentProject: any) => currentProject ? ({
          ...currentProject,
          videoRequest: data.videoRequest ? {
            id: data.videoRequest.id,
            status: data.videoRequest.status,
            amount: data.videoRequest.amount,
            providerTaskId: data.videoRequest.provider_task_id,
            videoUrl: data.videoRequest.video_url,
            errorMessage: data.videoRequest.error_message,
            paidAt: data.videoRequest.paid_at,
            completedAt: data.videoRequest.completed_at,
            createdAt: data.videoRequest.created_at,
            updatedAt: data.videoRequest.updated_at,
          } : currentProject.videoRequest,
        }) : currentProject)
        setMessage(data.message || 'Vídeo com letra em produção.')
        setVideoCheckoutLoading(false)
        return
      }

      throw new Error('A solicitação foi enviada, mas o status do vídeo não foi retornado.')
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar vídeo com letra')
      setVideoCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-10 w-10 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!project) {
    return <div className="min-h-screen py-10 text-center text-gray-400">{error || 'Projeto não encontrado'}</div>
  }

  const audioUrl = project.version?.audioUrl || project.version?.streamAudioUrl
  const projectVersions = Array.isArray(project.versions) ? project.versions : []
  const shouldShowVersionList = projectVersions.length > 0
  const isGeneratingCover = processing.toLowerCase().includes('capa')
  const generationMessage = musicGenerationMessages[generationMessageIndex % musicGenerationMessages.length]
  const premiumCoverLimit = studioStatus?.stats?.premiumCoverLimit || 0
  const premiumCoverGenerations = studioStatus?.stats?.premiumCoverGenerations || 0
  const hasStudioPlan = Boolean(studioStatus?.hasStudioPlan)
  const canPublishOnDcc = Boolean(studioStatus?.canPublish)
  const canCreateMusic = canCreateFromStudioStatus(studioStatus)
  const canReuseLyric = canCreateFromStudioStatus(studioStatus)
  const canGeneratePremiumCover = Boolean(studioStatus) && premiumCoverLimit > 0 && premiumCoverGenerations < premiumCoverLimit
  const currentVideoRequest = project.videoRequest
  const currentVideoStatus = currentVideoRequest ? videoRequestStatus[currentVideoRequest.status] || videoRequestStatus.requested : null
  const hasActiveVideoRequest = Boolean(currentVideoRequest && ['payment_pending', 'requested', 'in_production'].includes(currentVideoRequest.status))
  const inspiration = project.inspiration
  const voicePreferences = extractVoicePreferences(project.description)
  const incorporateCode = project.publicSlug
    ? `<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://www.dccmusic.online'}/embed/studio/${project.publicSlug}" width="100%" height="180" frameborder="0" allow="autoplay; encrypted-media" loading="lazy"></iframe>`
    : ''
  const isMusicRequestPending = Boolean(generationId && generationBackgroundMode && !audioUrl)

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
              description={generationId && !processing ? 'A geração continua em segundo plano. Você pode aguardar aqui ou fechar esta janela.' : undefined}
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

          {showInspirationPicker && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 px-3 py-5 backdrop-blur-sm sm:px-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-purple-400/30 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#050816,#090b16,#18092c)] shadow-2xl shadow-purple-950/50"
              >
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">Escolher inspiração</p>
                    <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">Qual versão você quer usar?</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
                      Ouça as músicas deste projeto e clique em usar na versão que deve servir de base para a nova criação.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInspirationPicker(false)}
                    className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 p-2 text-gray-300 transition hover:text-white sm:static"
                    aria-label="Fechar"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="border-b border-white/10 px-4 py-3 sm:px-5">
                  <p className="mb-2 text-xs font-bold text-purple-100">Como quer transformar?</p>
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

                  <div
                    ref={inspirationPickerRef}
                    className="flex max-h-[58vh] snap-x gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-3 pr-1"
                  >
                    {projectVersions.map((version: any, index: number) => {
                      const versionAudioUrl = version.audioUrl || version.streamAudioUrl
                      const duration = formatAudioDuration(version.duration)
                      const versionNumber = projectVersions.length - index

                      return (
                        <article key={version.id} className="min-w-[82vw] snap-center rounded-3xl border border-purple-400/20 bg-black/35 p-4 shadow-xl shadow-black/30 sm:min-w-[26rem] lg:min-w-[30rem]">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-green-300">Música gerada #{versionNumber}</p>
                              <h3 className="mt-1 line-clamp-2 font-black text-white">
                                {version.versionName || version.style || 'Versão gerada'}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(version.createdAt).toLocaleString('pt-BR')}
                                {duration ? ` · Duração ${duration}` : ''}
                              </p>
                            </div>
                            {version.isCurrent && (
                              <span className="rounded-full bg-green-950 px-3 py-1 text-xs font-bold text-green-300">
                                atual
                              </span>
                            )}
                          </div>

                          {versionAudioUrl ? (
                            <StudioAudioPlayer src={versionAudioUrl} label={`Música gerada #${versionNumber}`} />
                          ) : (
                            <p className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-500">Áudio sem URL registrada.</p>
                          )}

                          <button
                            type="button"
                            onClick={() => reuseLyricInNewProject(version.id)}
                            disabled={Boolean(processing) || !canReuseLyric || !versionAudioUrl}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-black text-white transition hover:scale-[1.01] disabled:opacity-60"
                          >
                            {processing ? <FiLoader className="animate-spin" /> : <FiMusic />}
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
              </motion.div>
            </div>
          )}

          {isMusicRequestPending ? (
            <PendingMusicRequestSummary
              project={project}
              projectId={projectId}
              message={message || MUSIC_GENERATION_BACKGROUND_MESSAGE}
              elapsedTime={formatGenerationTime(generationElapsedSeconds)}
              voicePreferences={voicePreferences}
              onRefresh={async () => {
                if (generationId) await checkGeneration(generationId)
                await loadProject({ silent: true, notifyReady: true, skipGenerationCheck: true })
              }}
            />
          ) : (
          <div className="grid w-full max-w-full gap-4 lg:grid-cols-[0.88fr_1.12fr] lg:gap-5">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-gray-950/85 shadow-2xl shadow-black/30 sm:rounded-[1.75rem]">
                <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#111827,#1f1235,#020617)] sm:aspect-square">
                  {project.cover?.imageUrl ? (
                    <img src={project.cover.imageUrl} alt={project.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-gray-400">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-purple-200">
                        <FiMusic className="h-10 w-10" />
                      </div>
                      <p className="mt-4 max-w-xs text-sm leading-relaxed">
                        A capa aparece aqui depois que a música for criada.
                      </p>
                    </div>
                  )}

                  {isGeneratingCover && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-8 text-center backdrop-blur-sm">
                      <FiLoader className="mb-4 h-12 w-12 animate-spin text-purple-300" />
                      <p className="text-xl font-black text-white">Gerando capa...</p>
                      <p className="mt-2 text-sm text-gray-300">
                        A IA está criando uma imagem mais bonita. Isso pode levar alguns segundos.
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-purple-200">Projeto da música</p>
                      <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">{project.title}</h1>
                      <p className="mt-1 text-sm text-gray-400">{project.style || 'Livre'} · {project.mood || 'Sem clima'}</p>
                    </div>
                    <FiHeart className={`h-6 w-6 ${project.favorite ? 'fill-red-400 text-red-400' : 'text-gray-500'}`} />
                  </div>

                  <details className="mt-4 rounded-2xl border border-primary-300/15 bg-primary-950/15 p-3">
                    <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wide text-primary-200">
                      Código do projeto para suporte
                    </summary>
                    <p className="mt-3 break-all font-mono text-xs text-gray-200">
                      {projectId}
                    </p>
                    <div className="mt-3">
                      <CopyButton text={projectId} label="Copiar código do projeto" />
                    </div>
                  </details>

                  <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-gray-400">
                      Detalhes do pedido
                    </summary>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-primary-400/20 bg-primary-950/50 px-3 py-1 font-semibold text-primary-100">Estilo: {project.style || 'Livre'}</span>
                      <span className="rounded-full border border-purple-400/20 bg-purple-950/50 px-3 py-1 font-semibold text-purple-100">Clima: {project.mood || 'Livre'}</span>
                      {project.structure && <span className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 font-semibold text-gray-200">Formato: {project.structure}</span>}
                      {project.lineCount && <span className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 font-semibold text-gray-200">Tamanho: {project.lineCount}</span>}
                      {voicePreferences && <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-950/50 px-3 py-1 font-semibold text-fuchsia-100">Voz: {voicePreferences}</span>}
                    </div>
                  </details>

                  {audioUrl && !shouldShowVersionList && (
                    <div className="mt-4">
                      <StudioAudioPlayer src={audioUrl} label={project.title || 'Música gerada'} />
                    </div>
                  )}

                  {projectVersions.length > 1 && (
                    <div className="mt-5 rounded-2xl border border-green-900/50 bg-green-950/15 p-4">
                      <p className="text-sm font-bold text-green-100">
                        Este projeto tem {projectVersions.length} músicas geradas.
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        As versões aparecem abaixo para você ouvir e escolher sem repetir a música aqui em cima.
                      </p>
                    </div>
                  )}

                  {inspiration && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-yellow-500/50 bg-gradient-to-br from-yellow-950/35 via-purple-950/25 to-black p-4 sm:p-5">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-500/15 px-3 py-1 text-xs font-bold text-yellow-100">
                        <FiZap /> Usando inspiração
                      </div>
                      <h2 className="text-lg font-black text-white">
                        Este projeto está usando “{inspiration.sourceTitle}” como inspiração.
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-yellow-50/90">
                        Quando você clicar em criar música, nossa IA vai usar o áudio dessa música original como referência para seguir a melodia, pegada e estilo. A letra aqui pode ser editada livremente.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {inspiration.sourceStyle && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">Estilo original: {inspiration.sourceStyle}</span>}
                        {inspiration.sourceMood && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">Clima original: {inspiration.sourceMood}</span>}
                        {inspiration.variationLabel && <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">Direção: {inspiration.variationLabel}</span>}
                        <span className="rounded-full bg-black/40 px-3 py-1 text-yellow-100">Pronto para criar música</span>
                      </div>
                    </div>
                  )}

                  {audioUrl && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-950/25 via-purple-950/25 to-black p-4">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/20 px-3 py-1 text-xs font-bold text-fuchsia-100">
                        <FiVideo /> Vídeo com letra
                      </div>
                      <h2 className="text-lg font-black text-white">Criar vídeo com letra</h2>
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">
                        Gera um vídeo simples com capa, nome da música e letra acompanhando o áudio.
                      </p>
                      <button
                        type="button"
                        onClick={requestVideoClip}
                        disabled={videoCheckoutLoading || hasActiveVideoRequest}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-bold text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-70"
                      >
                        {videoCheckoutLoading ? (
                          <>
                            <FiLoader className="animate-spin" /> Gerando vídeo...
                          </>
                        ) : hasActiveVideoRequest ? (
                          <>
                            <FiClock /> Vídeo já solicitado
                          </>
                        ) : (
                          <>
                            <FiVideo /> Gerar vídeo com letra
                          </>
                        )}
                      </button>
                      {hasActiveVideoRequest && (
                        <p className="mt-2 text-center text-xs text-purple-100/80">
                          Aguarde a finalização da solicitação atual antes de gerar outro vídeo.
                        </p>
                      )}
                    </div>
                  )}

                  {currentVideoRequest && currentVideoStatus && (
                    <div className="mt-4 rounded-2xl border border-purple-700/60 bg-purple-950/25 p-4 sm:p-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-sm font-bold text-purple-100">
                          {currentVideoRequest.status === 'completed' ? <FiCheckCircle className="text-green-300" /> : <FiClock className="text-purple-300" />}
                          Andamento do vídeo com letra
                        </div>
                        <span className="rounded-full border border-purple-500/50 bg-black/30 px-3 py-1 text-xs font-bold text-purple-100">
                          {currentVideoStatus.label}
                        </span>
                      </div>
                      <p className="text-sm text-purple-100/90">{currentVideoStatus.description}</p>
                      {currentVideoRequest.videoUrl && (
                        <a
                          href={currentVideoRequest.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 font-bold text-white hover:from-green-500 hover:to-emerald-500"
                        >
                          <FiExternalLink /> Assistir / baixar vídeo
                        </a>
                      )}
                      {currentVideoRequest.errorMessage && (
                        <p className="mt-3 text-xs text-red-200">
                          Detalhe: {currentVideoRequest.errorMessage}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-purple-200/70">
                        Solicitado em {new Date(currentVideoRequest.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 rounded-3xl border border-purple-300/15 bg-gradient-to-br from-purple-950/30 via-gray-950 to-black p-3">
                    <div>
                      <p className="text-sm font-black text-white">O que você quer fazer agora?</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        Escolha uma ação abaixo. Você pode salvar a letra antes de criar ou publicar.
                      </p>
                    </div>
                    {!audioUrl && (
                      <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-purple-100" htmlFor="project-voice-profile">
                          <FiMic /> Usar minha voz cadastrada
                        </label>
                        {voices.length > 0 ? (
                          <>
                            <div id="project-voice-profile" className="mt-3 grid gap-2">
                              <button
                                type="button"
                                onClick={() => handleVoiceSelection('')}
                                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${!selectedVoiceId ? 'border-primary-400 bg-primary-950/50 text-white' : 'border-purple-800/70 bg-gray-950 text-purple-100 hover:border-purple-500'}`}
                              >
                                Não usar voz cadastrada
                              </button>
                              {voices.map((voice) => (
                                <button
                                  key={voice.id}
                                  type="button"
                                  onClick={() => handleVoiceSelection(voice.id)}
                                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${selectedVoiceId === voice.id ? 'border-primary-400 bg-primary-950/50 text-white' : 'border-purple-800/70 bg-gray-950 text-purple-100 hover:border-purple-500'}`}
                                >
                                  {voice.displayName}
                                </button>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-purple-100/80">
                              Toque em uma opção acima. Se escolher uma voz, ela será usada na criação da música.
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-purple-100/80">
                            Você ainda não tem uma voz pronta. Para usar voz própria, cadastre e aguarde ela aparecer como pronta em Minhas vozes.
                          </p>
                        )}
                      </div>
                    )}
                    {!audioUrl && selectedVoiceId && voices.length === 0 && (
                      <div className="rounded-2xl border border-purple-800/60 bg-purple-950/20 p-4">
                        <p className="flex items-center gap-2 text-sm font-bold text-purple-100">
                          <FiMic /> Voz escolhida: {voices.find((voice) => voice.id === selectedVoiceId)?.displayName || 'voz cadastrada'}
                        </p>
                        <p className="mt-2 text-xs text-purple-100/80">
                          Essa voz foi escolhida na etapa anterior e será usada ao criar a música.
                        </p>
                      </div>
                    )}
                    {!audioUrl && (
                      <button onClick={createMusic} disabled={Boolean(processing) || !canCreateMusic} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 via-purple-500 to-fuchsia-500 px-4 py-3.5 font-black text-white shadow-lg shadow-purple-950/40 transition hover:from-primary-400 hover:via-purple-400 hover:to-fuchsia-400 disabled:opacity-60">
                        <FiMusic /> Criar música agora
                      </button>
                    )}
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
                          aria-label="Informação sobre capas"
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gray-900 text-sm font-black text-gray-300 hover:border-purple-500 hover:text-white"
                        >
                          ?
                        </button>
                        <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-xl border border-purple-700/60 bg-gray-950 px-4 py-3 text-xs leading-relaxed text-purple-100 shadow-xl shadow-black/40 group-hover:block">
                          A capa profissional é uma imagem mais bonita feita por IA. Ela depende do seu plano.
                        </div>
                      </div>
                    </div>
                    {!studioStatus ? (
                      <p className="text-center text-xs text-gray-500">
                        Carregando permissões do plano...
                      </p>
                    ) : (
                      premiumCoverLimit > 0 && <p className="text-center text-xs text-gray-500">
                        Capas profissionais usadas neste mês: {premiumCoverGenerations} / {premiumCoverLimit}
                      </p>
                    )}
                    {project.status === 'published' ? (
                      <button onClick={unpublishProject} disabled={Boolean(processing) || !canPublishOnDcc} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-950/30 px-4 py-3 font-bold text-yellow-100 transition hover:bg-yellow-900/40 disabled:opacity-60">
                        <FiEyeOff /> Despublicar música
                      </button>
                    ) : (
                      <button onClick={publishProject} disabled={Boolean(processing) || !canPublishOnDcc} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 font-bold text-white transition hover:bg-green-600 disabled:opacity-60">
                        <FiZap /> Publicar música no DCC Music
                      </button>
                    )}
                    {project.status === 'published' && project.publicSlug && (
                      <Link href={`/studio/${project.publicSlug}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100">
                        <FiExternalLink /> Ver página pública
                      </Link>
                    )}
                    {project.cover?.imageUrl && (
                      <button type="button" onClick={downloadCoverImage} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-gray-100">
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
              {message && (
                <div
                  ref={message === MUSIC_GENERATION_BACKGROUND_MESSAGE ? backgroundMessageRef : undefined}
                  tabIndex={message === MUSIC_GENERATION_BACKGROUND_MESSAGE ? -1 : undefined}
                  className="rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200 outline-none ring-green-500/40 focus:ring-2"
                >
                  {message}
                </div>
              )}

              {shouldShowVersionList && (
                <section className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] sm:p-5">
                  <div className="mb-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-green-300">Música pronta</p>
                    <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Escolha sua versão</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Ouça as versões geradas abaixo. A versão atual está marcada, mas todas ficam disponíveis aqui.
                    </p>
                  </div>
                  <div className="grid gap-3">
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
                                  Versão {versionNumber}
                                </p>
                                {version.isCurrent && (
                                  <span className="rounded-full bg-green-950 px-2.5 py-1 text-[11px] font-bold text-green-300">
                                    atual
                                  </span>
                                )}
                                {version.isPublished && (
                                  <span className="rounded-full bg-primary-950 px-2.5 py-1 text-[11px] font-bold text-primary-200">
                                    publicada
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-1 line-clamp-2 font-black text-white">
                                {version.versionName || version.style || `Música gerada #${versionNumber}`}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(version.createdAt).toLocaleString('pt-BR')}
                                {duration ? ` · ${duration}` : ''}
                              </p>
                            </div>
                          </div>
                          {versionAudioUrl ? (
                            <StudioAudioPlayer src={versionAudioUrl} label={`Versão ${versionNumber}`} />
                          ) : (
                            <p className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-500">Áudio sem URL registrada.</p>
                          )}
                          {versionAudioUrl && (
                            <button
                              type="button"
                              onClick={() => setShowInspirationPicker(true)}
                              disabled={Boolean(processing) || !canReuseLyric}
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-950/30 px-4 py-3 text-sm font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-900/40 disabled:opacity-60 sm:w-auto"
                            >
                              <FiMusic /> Criar nova versão usando esta como inspiração
                            </button>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white sm:text-2xl">Letra da música</h2>
                    <p className="mt-1 text-xs text-gray-400">Você pode corrigir qualquer palavra antes de criar ou publicar.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button onClick={saveLyric} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-gray-100 hover:bg-white/[0.09] sm:w-auto">
                      <FiSave /> Salvar letra
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

              <details className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 sm:rounded-[1.75rem] sm:p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-white">Ajustes finos da letra</h2>
                      <p className="mt-1 text-xs text-gray-400">
                        Abra se quiser melhorar a letra ou passar instruções extras para a próxima geração.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-gray-300">
                      opcional
                    </span>
                  </div>
                </summary>

                <div className="mt-4 space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-bold text-white">Melhorar letra com IA</p>
                    <div className="flex flex-wrap gap-2">
                      {refineActions.map(([action, label]) => (
                        <button
                          key={action}
                          onClick={() => refineLyric(action)}
                          disabled={Boolean(processing)}
                          className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-primary-400/60 hover:bg-primary-950/30 disabled:opacity-60"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                    <label className="block text-sm font-bold text-purple-100" htmlFor="studio-extra-instructions">
                      Outras instruções para a música
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-purple-100/70">
                      Opcional. Use para orientar voz, emoção, interpretação, instrumentos ou detalhes da próxima geração.
                    </p>
                    <textarea
                      id="studio-extra-instructions"
                      value={extraInstructions}
                      onChange={(event) => handleExtraInstructionsChange(event.target.value)}
                      rows={4}
                      maxLength={700}
                      placeholder="Ex.: usar minha voz cadastrada com interpretação masculina calma e expressiva, cantando de forma inspiradora, suave, quente e serena. Ideal para sertanejo motivacional, música emocional e narrativa."
                      className="mt-3 w-full resize-none rounded-2xl border border-purple-300/20 bg-gray-950 px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-primary-400"
                    />
                    <p className="mt-2 text-right text-[11px] text-gray-500">
                      {extraInstructions.length}/700
                    </p>
                  </div>
                </div>
              </details>

              <section className="rounded-[1.5rem] border border-white/10 bg-gray-950/80 p-4 sm:rounded-[1.75rem] sm:p-5">
                <h2 className="mb-2 text-lg font-black text-white">Link para compartilhar</h2>
                <p className="mb-4 text-sm leading-relaxed text-gray-400">
                  Depois de publicar, a música ganha uma página pública para você enviar para outras pessoas.
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
                          Copie o código abaixo e cole no site onde a música deve aparecer.
                        </p>
                        <textarea
                          readOnly
                          value={incorporateCode}
                          rows={4}
                          className="w-full resize-none rounded-xl border border-gray-700 bg-black/60 p-3 font-mono text-xs text-gray-200 outline-none"
                        />
                        <div className="mt-3">
                          <CopyButton text={incorporateCode} label="Copiar código" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-gray-400">
                    Publique a música para liberar o link público e a opção de colocar em outro site.
                  </p>
                )}
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
  const [refreshing, setRefreshing] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const summaryItems = [
    ['Nome', project.title || 'Sua música'],
    ['Estilo', project.style || 'Livre'],
    ['Clima', project.mood || 'Livre'],
    ['Formato', project.structure || 'Livre'],
    ['Tamanho', project.lineCount || 'Não informado'],
    ['Voz', voicePreferences || 'A IA vai escolher'],
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
            Sua música está sendo criada
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
              Tempo decorrido: <span className="font-mono text-white">{elapsedTime}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-black text-white">Resumo do seu pedido</h2>
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
                <p className="text-[11px] font-black uppercase tracking-wide text-purple-200">Ideia enviada</p>
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
            <h2 className="mt-4 text-xl font-black text-white">O que acontece agora?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Não precisa clicar em criar música novamente. Sua solicitação já foi enviada para produção.
              Quando o áudio ficar pronto, esta página atualiza sozinha e também enviamos um e-mail.
            </p>
            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-relaxed text-gray-300">
              <p><strong className="text-white">Código do projeto:</strong> {projectId}</p>
              <p>Você pode fechar esta tela e voltar em “Meus Projetos” mais tarde.</p>
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
  const isCover = message.toLowerCase().includes('capa')
  const steps = isCover
    ? ['Interpretando a letra', 'Criando direção visual', 'Gerando imagem', 'Salvando capa no projeto']
    : ['Criando letra', 'Compondo melodia', 'Produzindo instrumental', 'Gerando capa', 'Finalizando masterização']

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
            aria-label="Fechar acompanhamento"
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
            <span>Tempo decorrido</span>
            <span className="font-mono text-white">{elapsedTime}</span>
          </div>
        )}
        {onClose && (
          <p className="relative mx-auto mt-4 max-w-sm rounded-2xl border border-purple-700/50 bg-purple-950/30 px-3 py-3 text-xs leading-relaxed text-purple-100 sm:px-4">
            Fechar não cancela a música. Avisaremos por e-mail quando ela ficar pronta.
          </p>
        )}
        {previewAudioUrl && (
          <div className="relative mt-5 rounded-2xl border border-green-700/60 bg-green-950/30 p-4 text-left">
            <p className="mb-3 text-sm font-bold text-green-100">Prévia disponível enquanto finalizamos a música completa.</p>
            <StudioAudioPlayer src={previewAudioUrl} label="Prévia da música" />
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
  const hasNoBalance = message.toLowerCase().includes('créditos suficientes') || message.toLowerCase().includes('recarga')

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
        <h2 className="text-2xl font-black text-white">{hasNoBalance ? 'Você já usou sua música grátis ou está sem saldo' : 'Continue criando músicas'}</h2>
        <p className="mt-3 text-sm text-purple-100/90">{message}</p>
        <p className="mt-3 text-sm text-gray-300">
          Escolha um plano mensal ou compre créditos avulsos para continuar criando.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/studio-ia#planos"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
          >
            Ver planos do DCC Studio IA
          </Link>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center justify-center rounded-xl border border-purple-600 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/50"
          >
            Comprar recarga avulsa
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 px-5 py-3 font-bold text-gray-200 hover:bg-gray-900"
          >
            Agora não
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
