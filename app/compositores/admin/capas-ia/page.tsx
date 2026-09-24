'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  FiArrowLeft,
  FiClock,
  FiDownload,
  FiImage,
  FiLock,
  FiRefreshCw,
  FiShare2,
  FiZap,
} from 'react-icons/fi'

const musicStyles = [
  { value: 'Sertanejo', key: 'sertanejo' },
  { value: 'Funk', key: 'funk' },
  { value: 'Trap', key: 'trap' },
  { value: 'Gospel', key: 'gospel' },
  { value: 'Pagode', key: 'pagode' },
  { value: 'Rock', key: 'rock' },
  { value: 'MPB', key: 'mpb' },
  { value: 'Pop', key: 'pop' },
  { value: 'Eletrônica', key: 'electronic' },
]
const visualStyles = [
  { value: 'Realista', key: 'realistic' },
  { value: 'Cinematográfica', key: 'cinematic' },
  { value: 'Anime', key: 'anime' },
  { value: 'Vintage', key: 'vintage' },
  { value: 'Neon', key: 'neon' },
  { value: 'Minimalista', key: 'minimalist' },
  { value: 'Sombria', key: 'dark' },
  { value: 'Romântica', key: 'romantic' },
]
const textStyles = [
  { id: 'impact', labelKey: 'strong', canvasFont: 'bold 92px Impact, Arial Black, sans-serif', previewClass: 'font-black tracking-wide' },
  { id: 'classic', labelKey: 'classic', canvasFont: 'bold 86px Georgia, serif', previewClass: 'font-serif font-bold' },
  { id: 'modern', labelKey: 'modern', canvasFont: 'bold 86px Arial, sans-serif', previewClass: 'font-sans font-black' },
  { id: 'romantic', labelKey: 'romantic', canvasFont: 'italic bold 82px Georgia, serif', previewClass: 'font-serif font-bold italic' },
  { id: 'minimal', labelKey: 'minimal', canvasFont: '600 72px Arial, sans-serif', previewClass: 'font-sans font-semibold tracking-[0.18em] uppercase' },
]
const textColors = [
  { id: 'white', labelKey: 'white', value: '#ffffff', previewClass: 'text-white' },
  { id: 'gold', labelKey: 'gold', value: '#facc15', previewClass: 'text-yellow-300' },
  { id: 'purple', labelKey: 'purple', value: '#d946ef', previewClass: 'text-fuchsia-400' },
  { id: 'red', labelKey: 'red', value: '#f87171', previewClass: 'text-red-400' },
  { id: 'black', labelKey: 'black', value: '#111827', previewClass: 'text-gray-950' },
]
const knownCoverErrors = new Set([
  'unauthorized',
  'goldOnly',
  'load',
  'inputTooShort',
  'inputTooLong',
  'cooldown',
  'monthlyLimitReached',
  'generate',
])

type CoverHistoryItem = {
  id: string
  title: string | null
  musicStyle: string
  visualStyle: string
  createdAt: string
  imageUrl: string | null
}

type CoverStatus = {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  planName: string
  history: CoverHistoryItem[]
}

export default function AICoverGeneratorPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [composer, setComposer] = useState<any>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [status, setStatus] = useState<CoverStatus | null>(null)
  const [accessError, setAccessError] = useState('')
  const [title, setTitle] = useState('')
  const [showTextOnCover, setShowTextOnCover] = useState(true)
  const [coverText, setCoverText] = useState('')
  const [coverTextStyle, setCoverTextStyle] = useState('modern')
  const [coverTextColor, setCoverTextColor] = useState('white')
  const [inputText, setInputText] = useState('')
  const [coverDescription, setCoverDescription] = useState('')
  const [musicStyle, setMusicStyle] = useState('Sertanejo')
  const [visualStyle, setVisualStyle] = useState('Cinematográfica')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [currentCover, setCurrentCover] = useState<CoverHistoryItem | null>(null)

  const getApiError = (data: { errorCode?: string; waitSeconds?: number }, fallback: string) => (
    data.errorCode && knownCoverErrors.has(data.errorCode)
      ? t(`covers.errors.${data.errorCode}`, { count: data.waitSeconds })
      : t(fallback)
  )

  const displayMusicStyle = (value: string) => {
    const style = musicStyles.find((item) => item.value === value)
    return style ? t(`covers.musicStyles.${style.key}`) : value
  }

  const displayVisualStyle = (value: string) => {
    const style = visualStyles.find((item) => item.value === value)
    return style ? t(`covers.visualStyles.${style.key}`) : value
  }

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login')
      return
    }

    try {
      setComposer(JSON.parse(composerData))
      loadStatus(token)
    } catch {
      localStorage.removeItem('composer_token')
      localStorage.removeItem('composer_data')
      router.push('/compositores/login')
    }
  }, [router])

  const usagePercent = useMemo(() => {
    if (!status?.limit) return 0
    return Math.min(100, Math.round((status.used / status.limit) * 100))
  }, [status])

  const selectedTextStyle = useMemo(
    () => textStyles.find((style) => style.id === coverTextStyle) || textStyles[2],
    [coverTextStyle]
  )
  const selectedTextColor = useMemo(
    () => textColors.find((color) => color.id === coverTextColor) || textColors[0],
    [coverTextColor]
  )

  const loadStatus = async (token = localStorage.getItem('composer_token')) => {
    if (!token) return

    setLoadingStatus(true)
    setAccessError('')

    try {
      const response = await fetch('/api/compositores/capas-ia', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))

      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        localStorage.removeItem('composer_data')
        router.push('/compositores/login')
        return
      }

      if (response.status === 403) {
        setAccessError(getApiError(data, 'covers.errors.goldOnly'))
        setStatus(null)
        return
      }

      if (!response.ok) {
        setAccessError(getApiError(data, 'covers.errors.load'))
        setStatus(null)
        return
      }

      setStatus(data)
      setCurrentCover(data.history?.[0] || null)
    } catch {
      setAccessError(t('covers.errors.load'))
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleGenerate = async (variation = false) => {
    setError('')
    setSuccessMessage('')

    if (!inputText.trim()) {
      setError(t('covers.errors.inputRequired'))
      return
    }

    setGenerating(true)

    try {
      const token = localStorage.getItem('composer_token')
      const response = await fetch('/api/compositores/capas-ia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          inputText: variation
            ? `${inputText}\n\n${t('covers.variationInstruction')}`
            : inputText,
          coverDescription,
          musicStyle,
          visualStyle,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(getApiError(data, 'covers.errors.generate'))
        return
      }

      setCurrentCover(data.cover)
      setStatus((previous) => previous
        ? {
            ...previous,
            used: data.used,
            remaining: data.remaining,
            history: [data.cover, ...previous.history.filter((cover) => cover.id !== data.cover.id)].slice(0, 24),
          }
        : previous
      )
      setSuccessMessage(variation ? t('covers.messages.variationCreated') : t('covers.messages.created'))
    } catch {
      setError(t('covers.errors.generate'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (cover: CoverHistoryItem | null) => {
    if (!cover?.imageUrl) return

    setError('')
    try {
      const textToApply = showTextOnCover ? (coverText.trim() || cover.title || title).trim() : ''
      const response = await fetch(cover.imageUrl)
      if (!response.ok) throw new Error('download')
      const blob = await response.blob()
      const imageObjectUrl = URL.createObjectURL(blob)

      if (textToApply) {
        const image = new Image()
        image.src = imageObjectUrl
        await image.decode()

      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 1024
      const context = canvas.getContext('2d')

      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        const gradient = context.createLinearGradient(0, 620, 0, 1024)
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
        gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.68)')
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.92)')
        context.fillStyle = gradient
        context.fillRect(0, 560, canvas.width, 464)

        context.fillStyle = selectedTextColor.value
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.shadowColor = 'rgba(0, 0, 0, 0.85)'
        context.shadowBlur = 20
        context.font = selectedTextStyle.canvasFont

        const maxWidth = 820
        const words = textToApply.split(/\s+/)
        const lines: string[] = []
        let line = ''

        words.forEach((word) => {
          const testLine = line ? `${line} ${word}` : word
          if (context.measureText(testLine).width > maxWidth && line) {
            lines.push(line)
            line = word
          } else {
            line = testLine
          }
        })
        if (line) lines.push(line)

        const visibleLines = lines.slice(0, 2)
        const startY = 800 - ((visibleLines.length - 1) * 52)
        visibleLines.forEach((textLine, index) => {
          context.strokeStyle = selectedTextColor.id === 'black' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.72)'
          context.lineWidth = 6
          context.strokeText(textLine, canvas.width / 2, startY + index * 104)
          context.fillText(textLine, canvas.width / 2, startY + index * 104)
        })

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return
          const pngUrl = URL.createObjectURL(pngBlob)
          const anchor = document.createElement('a')
          anchor.href = pngUrl
          anchor.download = `${textToApply || cover.title || title || t('covers.downloadFilename')}.png`
          anchor.click()
          URL.revokeObjectURL(pngUrl)
        }, 'image/png')
      }

        URL.revokeObjectURL(imageObjectUrl)
        return
      }

      const anchor = document.createElement('a')
      anchor.href = imageObjectUrl
      anchor.download = `${cover.title || title || t('covers.downloadFilename')}.png`
      anchor.click()
      URL.revokeObjectURL(imageObjectUrl)
    } catch {
      setError(t('covers.errors.download'))
    }
  }

  const handleShare = async (cover: CoverHistoryItem | null) => {
    if (!cover?.imageUrl) return

    setError('')
    try {
      if (navigator.share) {
        await navigator.share({
          title: cover.title || t('covers.share.title'),
          text: t('covers.share.text'),
          url: cover.imageUrl,
        })
        return
      }

      await navigator.clipboard.writeText(cover.imageUrl)
      setSuccessMessage(t('covers.messages.linkCopied'))
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      setError(t('covers.errors.share'))
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-gray-300">{t('covers.loading')}</p>
        </div>
      </div>
    )
  }

  if (accessError) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Link href="/compositores/admin" className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-8">
              <FiArrowLeft className="w-4 h-4" />
              <span>{t('covers.back')}</span>
            </Link>

            <div className="relative overflow-hidden rounded-3xl border border-yellow-700/60 bg-gradient-to-br from-yellow-950/50 via-gray-950 to-purple-950/40 p-8 text-center">
              <div className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-yellow-500/20 blur-3xl" />
              <FiLock className="relative mx-auto mb-4 h-12 w-12 text-yellow-300" />
              <h1 className="relative text-3xl sm:text-4xl font-bold mb-4">
                {t('covers.title')}
              </h1>
              <p className="relative text-lg text-gray-300 mb-6">
                {accessError}
              </p>
              <p className="relative text-sm text-gray-400 mb-8">
                {t('covers.access.description')}
              </p>
              <Link
                href="/compositores/planos"
                className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-yellow-500 to-purple-600 px-6 py-3 font-semibold text-white hover:from-yellow-400 hover:to-purple-500 transition-all"
              >
                {t('covers.access.viewGold')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/compositores/admin" className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-8">
            <FiArrowLeft className="w-4 h-4" />
            <span>{t('covers.back')}</span>
          </Link>

          <section className="relative overflow-hidden rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/40 p-6 sm:p-10 mb-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-950/40 px-4 py-2 text-sm text-primary-200">
                  <FiZap className="h-4 w-4" />
                  {t('covers.hero.badge')}
                </div>
                <h1 className="text-4xl sm:text-6xl font-black mb-4">
                  <span className="gradient-text">{t('covers.title')}</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-2xl">
                  {t('covers.hero.subtitle')}
                </p>
                <p className="text-gray-400 mt-4 max-w-2xl">
                  {t('covers.hero.description')}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/50 p-5 backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">{t('covers.usage.title')}</span>
                  <span className="text-sm font-semibold text-primary-300">
                    {t('covers.usage.used', { used: status?.used || 0, count: status?.limit || 100 })}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  {t('covers.usage.reset')}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6 sm:p-8 shadow-2xl shadow-purple-950/20">
              {error && (
                <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mb-5 rounded-xl border border-green-800 bg-green-950/50 px-4 py-3 text-sm text-green-200">
                  {successMessage}
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">{t('covers.form.songTitle')}</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('covers.form.songTitlePlaceholder')}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
                />
              </div>

              <div className="mb-5">
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                  <input
                    id="showTextOnCover"
                    type="checkbox"
                    checked={showTextOnCover}
                    onChange={(event) => setShowTextOnCover(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="showTextOnCover" className="cursor-pointer">
                    <span className="block text-sm font-semibold text-white">{t('covers.form.addText')}</span>
                    <span className="block text-xs text-gray-500">
                      {t('covers.form.addTextHint')}
                    </span>
                  </label>
                </div>
                <label className="block text-sm font-medium mb-2">{t('covers.form.coverText')}</label>
                <input
                  value={coverText}
                  onChange={(event) => setCoverText(event.target.value)}
                  disabled={!showTextOnCover}
                  placeholder={t('covers.form.coverTextPlaceholder')}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {t('covers.form.coverTextHint')}
                </p>

                {showTextOnCover && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('covers.form.fontStyle')}</label>
                      <select
                        value={coverTextStyle}
                        onChange={(event) => setCoverTextStyle(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
                      >
                        {textStyles.map((style) => (
                          <option key={style.id} value={style.id}>
                            {t(`covers.textStyles.${style.labelKey}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('covers.form.textColor')}</label>
                      <select
                        value={coverTextColor}
                        onChange={(event) => setCoverTextColor(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
                      >
                        {textColors.map((color) => (
                          <option key={color.id} value={color.id}>
                            {t(`covers.textColors.${color.labelKey}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">{t('covers.form.idea')}</label>
                <textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder={t('covers.form.ideaPlaceholder')}
                  rows={10}
                  className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-900 px-4 py-4 outline-none focus:border-primary-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">{t('covers.form.description')}</label>
                <textarea
                  value={coverDescription}
                  onChange={(event) => setCoverDescription(event.target.value)}
                  placeholder={t('covers.form.descriptionPlaceholder')}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-900 px-4 py-4 outline-none focus:border-primary-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {t('covers.form.descriptionHint')}
                </p>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold mb-3">{t('covers.form.musicStyle')}</h2>
                <div className="flex flex-wrap gap-2">
                  {musicStyles.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setMusicStyle(style.value)}
                      aria-pressed={musicStyle === style.value}
                      className={`rounded-full border px-4 py-2 text-sm transition-all ${
                        musicStyle === style.value
                          ? 'border-primary-400 bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-primary-500'
                      }`}
                    >
                      {t(`covers.musicStyles.${style.key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-3">{t('covers.form.visualStyle')}</h2>
                <div className="flex flex-wrap gap-2">
                  {visualStyles.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setVisualStyle(style.value)}
                      aria-pressed={visualStyle === style.value}
                      className={`rounded-full border px-4 py-2 text-sm transition-all ${
                        visualStyle === style.value
                          ? 'border-purple-300 bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-500'
                      }`}
                    >
                      {t(`covers.visualStyles.${style.key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGenerate(false)}
                disabled={generating || (status?.remaining || 0) <= 0}
                className="w-full rounded-2xl bg-gradient-to-r from-primary-600 via-purple-600 to-fuchsia-600 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-purple-950/40 transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? t('covers.generating') : t('covers.generate')}
              </button>

              {(status?.remaining || 0) <= 0 && (
                <p className="mt-4 text-center text-sm text-yellow-300">
                  {t('covers.limitReached')}
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl border border-gray-800 bg-black/70 p-5 min-h-[520px] flex flex-col justify-center">
                {generating ? (
                  <div className="text-center">
                    <div className="relative mx-auto mb-8 h-72 w-72 overflow-hidden rounded-3xl border border-primary-500/50 bg-gradient-to-br from-primary-950 via-black to-purple-950">
                      <div className="absolute inset-0 animate-pulse bg-gradient-to-tr from-primary-500/20 via-purple-500/10 to-transparent" />
                      <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-purple-500/30 blur-3xl" />
                      <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-primary-400/30 blur-3xl" />
                      <FiImage className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-primary-200" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{t('covers.generating')}</h3>
                    <p className="text-gray-400">{t('covers.generatingHint')}</p>
                  </div>
                ) : currentCover?.imageUrl ? (
                  <>
                    <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-purple-950/40">
                      <img
                        src={currentCover.imageUrl}
                        alt={currentCover.title || t('covers.alt.generated')}
                        className="aspect-square w-full object-cover"
                      />
                      {showTextOnCover && (coverText.trim() || currentCover.title || title) && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-6 pb-8 pt-24 text-center">
                          <h3 className={`text-3xl sm:text-4xl drop-shadow-2xl ${selectedTextStyle.previewClass} ${selectedTextColor.previewClass}`}>
                            {coverText.trim() || currentCover.title || title}
                          </h3>
                        </div>
                      )}
                    </div>
                    <div className="mt-5">
                      <h3 className="text-xl font-bold">{currentCover.title || title || t('covers.generatedTitle')}</h3>
                      <p className="text-sm text-gray-400">
                        {displayMusicStyle(currentCover.musicStyle)} · {displayVisualStyle(currentCover.visualStyle)}
                      </p>
                    </div>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleDownload(currentCover)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm hover:bg-gray-700"
                      >
                        <FiDownload /> {t('covers.actions.download')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerate(true)}
                        disabled={generating || (status?.remaining || 0) <= 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm hover:bg-primary-600 disabled:opacity-60"
                      >
                        <FiRefreshCw /> {t('covers.actions.variation')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(currentCover)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-sm hover:bg-purple-600"
                      >
                        <FiShare2 /> {t('covers.actions.share')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-3xl border border-dashed border-gray-700 bg-gray-900/70">
                      <FiImage className="h-16 w-16 text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{t('covers.empty.title')}</h3>
                    <p className="text-gray-400">
                      {t('covers.empty.description')}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{t('covers.library.title')}</h2>
                  <FiClock className="text-primary-300" />
                </div>
                {status?.history?.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {status.history.map((cover) => (
                      <button
                        key={cover.id}
                        type="button"
                        onClick={() => setCurrentCover(cover)}
                        aria-pressed={currentCover?.id === cover.id}
                        aria-label={t('covers.library.select', { title: cover.title || t('covers.library.untitled') })}
                        className="group text-left"
                      >
                        {cover.imageUrl ? (
                          <img
                            src={cover.imageUrl}
                            alt={cover.title || t('covers.alt.cover')}
                            className="aspect-square w-full rounded-xl object-cover ring-1 ring-gray-800 transition-all group-hover:ring-primary-400"
                          />
                        ) : (
                          <div className="aspect-square rounded-xl bg-gray-900 ring-1 ring-gray-800" />
                        )}
                        <p className="mt-2 truncate text-sm font-medium">{cover.title || t('covers.library.untitled')}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(cover.createdAt).toLocaleDateString(i18n.language)}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {t('covers.library.empty')}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
