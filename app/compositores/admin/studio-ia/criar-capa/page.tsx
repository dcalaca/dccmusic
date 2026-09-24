'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiCreditCard, FiDownload, FiImage, FiLoader, FiUploadCloud, FiZap } from 'react-icons/fi'
import { useLocalization } from '@/components/LocalizationProvider'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

type CoverItem = {
  id: string
  title: string | null
  musicStyle: string
  visualStyle: string
  createdAt: string
  imageUrl: string | null
}

const fallbackOptions = {
  musicStyles: ['Sertanejo', 'Romântico', 'Gospel', 'Funk', 'Brega romântico popular', 'Pagode', 'Pop', 'Trap', 'Rock', 'Livre'],
  visualStyles: ['Moderno', 'Antigo', 'Cinematográfico', 'Luxo', 'Romântico', 'Sombrio', 'Colorido', 'Minimalista'],
  environments: ['Sertão', 'Cidade', 'Praia', 'Palco', 'Fazenda', 'Rua à noite', 'Estúdio musical', 'Céu estrelado'],
  artDirections: ['Realista', 'Desenho', 'Cena de filme', 'Pôster musical', 'Capa de álbum', 'Vintage', 'Neon', 'Editorial'],
  qualities: [
    { id: 'low', label: 'Qualidade baixa', credits: 10 },
    { id: 'medium', label: 'Qualidade média', credits: 20 },
    { id: 'pro', label: 'Qualidade pró', credits: 30 },
  ],
}

const unitedStatesOptions = {
  musicStyles: ['Pop', 'Hip-Hop / Rap', 'R&B', 'Country', 'Rock', 'Alternative / Indie', 'EDM / Dance', 'Gospel', 'Jazz', 'Blues', 'Folk', 'Soul', 'Metal', 'Punk', 'Latin Pop / Reggaeton'],
  visualStyles: ['Modern', 'Vintage', 'Cinematic', 'Luxury', 'Romantic', 'Dark', 'Colorful', 'Minimalist'],
  environments: ['City', 'Beach', 'Stage', 'Countryside', 'Night street', 'Music studio', 'Desert', 'Starry sky'],
  artDirections: ['Realistic', 'Illustration', 'Movie scene', 'Music poster', 'Album cover', 'Vintage', 'Neon', 'Editorial'],
  qualities: [
    { id: 'low', label: 'Low quality', credits: 10 },
    { id: 'medium', label: 'Medium quality', credits: 20 },
    { id: 'pro', label: 'Pro quality', credits: 30 },
  ],
}

const coverOptionTranslationKeys: Record<string, string> = {
  'Sertanejo': 'sertanejo',
  'Romântico': 'romantic',
  Gospel: 'gospel',
  Funk: 'funk',
  'Brega romântico popular': 'popularRomanticBrega',
  Pagode: 'pagode',
  Pop: 'pop',
  Trap: 'trap',
  Rock: 'rock',
  Livre: 'free',
  'Hip-Hop / Rap': 'hipHopRap',
  'R&B': 'rnb',
  Country: 'country',
  'Alternative / Indie': 'alternativeIndie',
  'EDM / Dance': 'edmDance',
  Jazz: 'jazz',
  Blues: 'blues',
  Folk: 'folk',
  Soul: 'soul',
  Metal: 'metal',
  Punk: 'punk',
  'Latin Pop / Reggaeton': 'latinPopReggaeton',
  Moderno: 'modern',
  Modern: 'modern',
  Antigo: 'vintage',
  Vintage: 'vintage',
  Cinematográfico: 'cinematic',
  Cinematic: 'cinematic',
  Luxo: 'luxury',
  Luxury: 'luxury',
  Romantic: 'romantic',
  Sombrio: 'dark',
  Dark: 'dark',
  Colorido: 'colorful',
  Colorful: 'colorful',
  Minimalista: 'minimalist',
  Minimalist: 'minimalist',
  Sertão: 'backlands',
  Cidade: 'city',
  City: 'city',
  Praia: 'beach',
  Beach: 'beach',
  Palco: 'stage',
  Stage: 'stage',
  Fazenda: 'farm',
  Countryside: 'countryside',
  'Rua à noite': 'nightStreet',
  'Night street': 'nightStreet',
  'Estúdio musical': 'musicStudio',
  'Music studio': 'musicStudio',
  Desert: 'desert',
  'Céu estrelado': 'starrySky',
  'Starry sky': 'starrySky',
  Realista: 'realistic',
  Realistic: 'realistic',
  Desenho: 'illustration',
  Illustration: 'illustration',
  'Cena de filme': 'movieScene',
  'Movie scene': 'movieScene',
  'Pôster musical': 'musicPoster',
  'Music poster': 'musicPoster',
  'Capa de álbum': 'albumCover',
  'Album cover': 'albumCover',
  Neon: 'neon',
  Editorial: 'editorial',
}

const selectClassName = 'w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500'
const optionClassName = 'bg-gray-950 text-white'
const MAX_COMPRESSED_REFERENCE_BYTES = 2200 * 1024
const REFERENCE_IMAGE_DIMENSIONS = [1800, 1600, 1400]
const REFERENCE_IMAGE_QUALITIES = [0.9, 0.84, 0.76]

function getOptionLabel(t: TFunction, group: 'musicStyles' | 'visualStyles' | 'environments' | 'artDirections', value: string) {
  const key = coverOptionTranslationKeys[value]
  const translationKey = `studio.tools.cover.options.${group}.${key}`
  return key ? t(translationKey, { defaultValue: t('studio.tools.cover.options.other') }) : t('studio.tools.cover.options.other')
}

function getQualityLabel(t: TFunction, qualityId: string) {
  return t(`studio.tools.cover.qualities.${qualityId}`)
}

function getApiError(t: TFunction, data: { errorCode?: string; creditCost?: number }, fallbackKey: string) {
  const key = `studio.tools.cover.errors.${data.errorCode}`
  return data.errorCode ? t(key, { count: data.creditCost, defaultValue: t(fallbackKey) }) : t(fallbackKey)
}

async function readApiResponse(response: Response, t: TFunction) {
  const responseText = await response.text()
  if (!responseText) return {}

  try {
    return JSON.parse(responseText)
  } catch {
    return {
      errorCode: response.status === 413 ? 'photosTooLarge' : undefined,
    }
  }
}

function loadImageFromFile(file: File, t: TFunction) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(t('studio.tools.cover.errors.photoUnreadable')))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number, t: TFunction) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(t('studio.tools.cover.errors.photoOptimize')))
        return
      }
      resolve(blob)
    }, 'image/jpeg', quality)
  })
}

async function compressReferenceImage(file: File, index: number, t: TFunction) {
  if (!file.type.startsWith('image/')) {
    throw new Error(t('studio.tools.cover.errors.unsupportedImage'))
  }

  const image = await loadImageFromFile(file, t)

  for (const maxDimension of REFERENCE_IMAGE_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('studio.tools.cover.errors.photoPrepare'))
    context.drawImage(image, 0, 0, width, height)

    for (const quality of REFERENCE_IMAGE_QUALITIES) {
      const blob = await canvasToBlob(canvas, quality, t)
      if (blob.size <= MAX_COMPRESSED_REFERENCE_BYTES) {
        return new File([blob], `referencia-${index + 1}.jpg`, { type: 'image/jpeg' })
      }
    }
  }

  throw new Error(t('studio.tools.cover.errors.photosTooLarge'))
}

export default function StudioCoverArtPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { country } = useLocalization()
  const isUnitedStates = String(country) === 'US' || String(country) === 'GB'
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [credits, setCredits] = useState({ cost: 10, remaining: 0, canCreate: false })
  const [options, setOptions] = useState(fallbackOptions)
  const [history, setHistory] = useState<CoverItem[]>([])
  const [currentCover, setCurrentCover] = useState<CoverItem | null>(null)
  const [referenceCount, setReferenceCount] = useState(0)
  const [selectedQuality, setSelectedQuality] = useState('low')

  useEffect(() => {
    loadStatus()
  }, [isUnitedStates])

  const loadStatus = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/criar-capa')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/compositores/studio/cover-art', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        router.push('/compositores/login?redirect=/compositores/admin/studio-ia/criar-capa')
        return
      }
      if (!response.ok) throw new Error(getApiError(t, data, 'studio.tools.cover.errors.load'))
      setCredits(data.credits || credits)
      setOptions(isUnitedStates ? unitedStatesOptions : data.options || fallbackOptions)
      setHistory(data.history || [])
      setCurrentCover(data.history?.[0] || null)
    } catch (err: any) {
      setError(err.message || t('studio.tools.cover.errors.load'))
    } finally {
      setLoading(false)
    }
  }

  const handleReferenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 3) {
      setError(t('studio.tools.cover.errors.maxPhotos'))
      event.target.value = ''
      setReferenceCount(0)
      return
    }
    setError('')
    setReferenceCount(files.length)
    if (files.length > 0) {
      setSelectedQuality('pro')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('composer_token')
    if (!token) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const referenceInput = form.elements.namedItem('referenceImages') as HTMLInputElement | null
    const files = Array.from(referenceInput?.files || [])
    if (files.length > 3) {
      setError(t('studio.tools.cover.errors.maxPhotos'))
      return
    }

    const userIdea = String(formData.get('userIdea') || '').trim()
    if (userIdea.length < 10) {
      setError(t('studio.tools.cover.errors.ideaRequired'))
      return
    }

    setGenerating(true)
    setError('')
    setMessage(files.length > 0 ? t('studio.tools.cover.optimizingPhotos') : '')
    try {
      if (files.length > 0) {
        const optimizedFiles = await Promise.all(files.map((file, index) => compressReferenceImage(file, index, t)))
        formData.delete('referenceImages')
        optimizedFiles.forEach((file) => formData.append('referenceImages', file))
      }

      const response = await fetch('/api/compositores/studio/cover-art', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await readApiResponse(response, t)
      if (!response.ok) throw new Error(getApiError(t, data, 'studio.tools.cover.errors.create'))
      setError('')
      setCurrentCover(data.cover)
      setHistory((current) => [data.cover, ...current.filter((cover) => cover.id !== data.cover.id)].slice(0, 24))
      setCredits((current) => ({
        ...current,
        remaining: data.credits?.remaining ?? Math.max(0, current.remaining - current.cost),
        canCreate: (data.credits?.remaining ?? 0) >= selectedQualityOption.credits,
      }))
      setMessage(t('studio.tools.cover.created'))
      window.dispatchEvent(new Event('studioBalanceChange'))
    } catch (err: any) {
      setMessage('')
      setError(err.message || t('studio.tools.cover.errors.create'))
    } finally {
      setGenerating(false)
    }
  }

  const selectedQualityOption = options.qualities.find((option) => option.id === selectedQuality) || options.qualities[0]
  const canCreateSelectedQuality = credits.remaining >= selectedQualityOption.credits

  const downloadCover = async (cover: CoverItem | null) => {
    if (!cover?.imageUrl) return
    try {
      const response = await fetch(cover.imageUrl)
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(cover.title || 'capa-dccmusic').replace(/[^\w-]+/g, '-').toLowerCase()}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('studio.tools.cover.errors.download'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/studio-ia" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> {t('common.actions.back')}
          </Link>

          <section className="mb-8 overflow-hidden rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                  <FiImage /> {t('studio.tools.cover.eyebrow')}
                </div>
                <h1 className="text-3xl font-black sm:text-5xl">
                  <span className="gradient-text">{t('studio.tools.cover.title')}</span>
                </h1>
                <p className="mt-3 max-w-2xl text-gray-300">
                  {t('studio.tools.cover.subtitle')}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/45 p-4 sm:p-5">
                <p className="text-sm font-bold text-gray-400">{t('studio.tools.cover.cost')}</p>
                <p className="mt-1 text-3xl font-black text-green-300">{selectedQualityOption.credits} {t('studio.tools.cover.credits')}</p>
                <p className="mt-1 text-sm text-gray-300">{getQualityLabel(t, selectedQualityOption.id)}. {t('studio.tools.cover.qualityHint')}</p>
                <p className="mt-3 text-sm text-gray-400">{t('studio.tools.cover.balance')}: <span className="font-bold text-white">{credits.remaining}</span> {t('studio.tools.cover.credits')}</p>
                {!canCreateSelectedQuality && (
                  <Link href="/compositores/admin/studio-ia/recarga" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-bold text-white">
                    <FiCreditCard /> {t('studio.tools.cover.buyCredits')}
                  </Link>
                )}
              </div>
            </div>
          </section>

          {message && <div className="mb-6 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <form onSubmit={handleSubmit} noValidate className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
              <h2 className="mb-5 text-2xl font-black">{t('studio.tools.cover.describe')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.songTitle')}</span>
                  <input name="songTitle" maxLength={80} placeholder={t('studio.tools.cover.songTitlePlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.artist')}</span>
                  <input name="artistName" maxLength={80} placeholder={t('studio.tools.cover.artistPlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.musicStyle')}</span>
                  <select name="musicStyle" defaultValue={isUnitedStates ? 'Pop' : 'Sertanejo'} className={selectClassName}>
                    {options.musicStyles.map((option) => <option key={option} value={option} className={optionClassName}>{getOptionLabel(t, 'musicStyles', option)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.visualStyle')}</span>
                  <select name="visualStyle" defaultValue={isUnitedStates ? 'Modern' : 'Moderno'} className={selectClassName}>
                    {options.visualStyles.map((option) => <option key={option} value={option} className={optionClassName}>{getOptionLabel(t, 'visualStyles', option)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.environment')}</span>
                  <select name="environment" defaultValue={isUnitedStates ? 'City' : 'Sertão'} className={selectClassName}>
                    {options.environments.map((option) => <option key={option} value={option} className={optionClassName}>{getOptionLabel(t, 'environments', option)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.artDirection')}</span>
                  <select name="artDirection" defaultValue={isUnitedStates ? 'Album cover' : 'Capa de álbum'} className={selectClassName}>
                    {options.artDirections.map((option) => <option key={option} value={option} className={optionClassName}>{getOptionLabel(t, 'artDirections', option)}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.prompt')}</span>
                <textarea
                  name="userIdea"
                  required
                  minLength={10}
                  rows={6}
                  placeholder={t('studio.tools.cover.promptPlaceholder')}
                  className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
                />
                <p className="mt-2 text-xs text-gray-500">{t('studio.tools.cover.promptHint')}</p>
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.cover.quality')}</span>
                <select
                  name="quality"
                  value={selectedQuality}
                  onChange={(event) => setSelectedQuality(event.target.value)}
                  className={selectClassName}
                >
                  {options.qualities.map((option) => (
                    <option key={option.id} value={option.id} className={optionClassName}>
                      {getQualityLabel(t, option.id)} - {option.credits} {t('studio.tools.cover.credits')}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  {t('studio.tools.cover.proHint')}
                </p>
              </label>

              <label className="mt-4 block rounded-2xl border border-dashed border-purple-700 bg-purple-950/20 p-4">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100">
                  <FiUploadCloud /> {t('studio.tools.cover.referencePhotos')}
                </span>
                <input name="referenceImages" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleReferenceChange} className="peer sr-only" />
                <span className="inline-flex rounded-lg bg-primary-600 px-4 py-2 font-bold text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white">{t('studio.tools.cover.choosePhotos')}</span>
                <p className="mt-2 text-xs text-purple-100/80">
                  {referenceCount > 0
                    ? t('studio.tools.cover.photosSelected', { count: referenceCount })
                    : t('studio.tools.cover.referenceOptional')}
                </p>
                <p className="mt-1 text-xs text-purple-100/70">
                  {t('studio.tools.cover.optimizeHint')}
                </p>
              </label>

              <button disabled={generating || !canCreateSelectedQuality} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 text-lg font-black text-white disabled:opacity-60">
                {generating ? <FiLoader className="animate-spin" /> : <FiZap />}
                {generating
                  ? t('studio.tools.cover.creating')
                  : t('studio.tools.cover.create', { count: selectedQualityOption.credits })}
              </button>
            </form>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                <h2 className="mb-4 text-xl font-black">{t('studio.tools.cover.result')}</h2>
                {currentCover?.imageUrl ? (
                  <div>
                    <img src={currentCover.imageUrl} alt={currentCover.title || t('studio.tools.cover.createdCoverAlt')} className="aspect-square w-full rounded-2xl object-cover" />
                    <button onClick={() => downloadCover(currentCover)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 font-bold hover:bg-gray-700">
                      <FiDownload /> {t('studio.tools.cover.download')}
                    </button>
                  </div>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl border border-gray-800 bg-black/30 text-center text-gray-500">
                    {t('studio.tools.cover.resultPlaceholder')}
                  </div>
                )}
              </section>

              {history.length > 0 && (
                <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                  <h2 className="mb-4 text-xl font-black">{t('studio.tools.cover.history')}</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {history.slice(0, 9).map((cover) => (
                      <button key={cover.id} type="button" onClick={() => setCurrentCover(cover)} className="overflow-hidden rounded-xl border border-gray-800 hover:border-primary-500">
                        {cover.imageUrl ? <img src={cover.imageUrl} alt={cover.title || t('studio.tools.cover.coverAlt')} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-gray-900" />}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
