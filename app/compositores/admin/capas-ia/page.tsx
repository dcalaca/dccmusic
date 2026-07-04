'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

const musicStyles = ['Sertanejo', 'Funk', 'Trap', 'Gospel', 'Pagode', 'Rock', 'MPB', 'Pop', 'Eletrônica']
const visualStyles = ['Realista', 'Cinematográfica', 'Anime', 'Vintage', 'Neon', 'Minimalista', 'Sombria', 'Romântica']
const textStyles = [
  { id: 'impact', label: 'Forte', canvasFont: 'bold 92px Impact, Arial Black, sans-serif', previewClass: 'font-black tracking-wide' },
  { id: 'classic', label: 'Clássica', canvasFont: 'bold 86px Georgia, serif', previewClass: 'font-serif font-bold' },
  { id: 'modern', label: 'Moderna', canvasFont: 'bold 86px Arial, sans-serif', previewClass: 'font-sans font-black' },
  { id: 'romantic', label: 'Romântica', canvasFont: 'italic bold 82px Georgia, serif', previewClass: 'font-serif font-bold italic' },
  { id: 'minimal', label: 'Minimalista', canvasFont: '600 72px Arial, sans-serif', previewClass: 'font-sans font-semibold tracking-[0.18em] uppercase' },
]
const textColors = [
  { id: 'white', label: 'Branco', value: '#ffffff', previewClass: 'text-white' },
  { id: 'gold', label: 'Dourado', value: '#facc15', previewClass: 'text-yellow-300' },
  { id: 'purple', label: 'Roxo Neon', value: '#d946ef', previewClass: 'text-fuchsia-400' },
  { id: 'red', label: 'Vermelho', value: '#f87171', previewClass: 'text-red-400' },
  { id: 'black', label: 'Preto', value: '#111827', previewClass: 'text-gray-950' },
]

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
      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        localStorage.removeItem('composer_data')
        router.push('/compositores/login')
        return
      }

      if (response.status === 403) {
        setAccessError(data.error || 'Recurso exclusivo para assinantes ativos do Plano Ouro.')
        setStatus(null)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar Gerador de Capas IA')
      }

      setStatus(data)
      setCurrentCover(data.history?.[0] || null)
    } catch (err: any) {
      setAccessError(err.message || 'Erro ao carregar Gerador de Capas IA')
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleGenerate = async (variation = false) => {
    setError('')
    setSuccessMessage('')

    if (!inputText.trim()) {
      setError('Cole a letra da música ou descreva sua ideia antes de gerar.')
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
            ? `${inputText}\n\nCrie uma nova variação visual mantendo a mesma emoção central.`
            : inputText,
          coverDescription,
          musicStyle,
          visualStyle,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar capa')
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
      setSuccessMessage(variation ? 'Nova variação criada com sucesso.' : 'Capa criada com sucesso.')
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar capa')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (cover: CoverHistoryItem | null) => {
    if (!cover?.imageUrl) return

    const textToApply = showTextOnCover ? (coverText.trim() || cover.title || title).trim() : ''
    const response = await fetch(cover.imageUrl)
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
          anchor.download = `${textToApply || cover.title || title || 'capa-dccmusic'}.png`
          anchor.click()
          URL.revokeObjectURL(pngUrl)
        }, 'image/png')
      }

      URL.revokeObjectURL(imageObjectUrl)
      return
    }

    const url = imageObjectUrl
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${cover.title || title || 'capa-dccmusic'}.png`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async (cover: CoverHistoryItem | null) => {
    if (!cover?.imageUrl) return

    if (navigator.share) {
      await navigator.share({
        title: cover.title || 'Capa criada no DCCMusic',
        text: 'Capa criada com o Gerador de Capas IA da DCCMusic.',
        url: cover.imageUrl,
      })
      return
    }

    await navigator.clipboard.writeText(cover.imageUrl)
    setSuccessMessage('Link temporário da capa copiado.')
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-gray-300">Carregando recurso premium...</p>
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
              <span>Voltar</span>
            </Link>

            <div className="relative overflow-hidden rounded-3xl border border-yellow-700/60 bg-gradient-to-br from-yellow-950/50 via-gray-950 to-purple-950/40 p-8 text-center">
              <div className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-yellow-500/20 blur-3xl" />
              <FiLock className="relative mx-auto mb-4 h-12 w-12 text-yellow-300" />
              <h1 className="relative text-3xl sm:text-4xl font-bold mb-4">
                Gerador de Capas IA
              </h1>
              <p className="relative text-lg text-gray-300 mb-6">
                {accessError}
              </p>
              <p className="relative text-sm text-gray-400 mb-8">
                Este recurso foi criado para assinantes ativos do Plano Ouro e permite gerar capas profissionais com IA.
              </p>
              <Link
                href="/compositores/planos"
                className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-yellow-500 to-purple-600 px-6 py-3 font-semibold text-white hover:from-yellow-400 hover:to-purple-500 transition-all"
              >
                Ver Plano Ouro
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
            <span>Voltar</span>
          </Link>

          <section className="relative overflow-hidden rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/40 p-6 sm:p-10 mb-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-950/40 px-4 py-2 text-sm text-primary-200">
                  <FiZap className="h-4 w-4" />
                  Exclusivo Plano Ouro
                </div>
                <h1 className="text-4xl sm:text-6xl font-black mb-4">
                  <span className="gradient-text">Gerador de Capas IA</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-2xl">
                  Transforme sua música em uma capa profissional em segundos.
                </p>
                <p className="text-gray-400 mt-4 max-w-2xl">
                  A IA interpreta emoção, estilo, ambiente e sentimento principal para criar artes modernas e cinematográficas.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/50 p-5 backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Uso mensal</span>
                  <span className="text-sm font-semibold text-primary-300">
                    {status?.used || 0} / {status?.limit || 100} capas utilizadas
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  O contador reseta automaticamente todo mês.
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
                <label className="block text-sm font-medium mb-2">Nome da música</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex: Idiota perfeito"
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
                    <span className="block text-sm font-semibold text-white">Adicionar texto na capa</span>
                    <span className="block text-xs text-gray-500">
                      Desmarque para gerar e baixar a capa sem nada escrito.
                    </span>
                  </label>
                </div>
                <label className="block text-sm font-medium mb-2">Texto na capa (opcional)</label>
                <input
                  value={coverText}
                  onChange={(event) => setCoverText(event.target.value)}
                  disabled={!showTextOnCover}
                  placeholder="Ex: Pedra no peito"
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Se ativado e deixar vazio, o site usa o nome da música. O texto é aplicado pelo site para ficar legível.
                </p>

                {showTextOnCover && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Estilo da fonte</label>
                      <select
                        value={coverTextStyle}
                        onChange={(event) => setCoverTextStyle(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
                      >
                        {textStyles.map((style) => (
                          <option key={style.id} value={style.id}>
                            {style.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Cor do texto</label>
                      <select
                        value={coverTextColor}
                        onChange={(event) => setCoverTextColor(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
                      >
                        {textColors.map((color) => (
                          <option key={color.id} value={color.id}>
                            {color.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Cole aqui a letra da música ou descreva sua ideia</label>
                <textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="Ex: Música sertaneja sofrida em um bar à noite, clima de saudade..."
                  rows={10}
                  className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-900 px-4 py-4 outline-none focus:border-primary-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Descrição da capa (deixe vazio para gerar apenas a imagem)</label>
                <textarea
                  value={coverDescription}
                  onChange={(event) => setCoverDescription(event.target.value)}
                  placeholder="Ex: Um casal afastado em uma estrada molhada, luz de poste, clima triste e cinematográfico..."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-900 px-4 py-4 outline-none focus:border-primary-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Use esse campo somente se quiser direcionar a imagem. Não é necessário escrever prompt técnico.
                </p>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold mb-3">Seleção de estilo musical</h2>
                <div className="flex flex-wrap gap-2">
                  {musicStyles.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setMusicStyle(style)}
                      className={`rounded-full border px-4 py-2 text-sm transition-all ${
                        musicStyle === style
                          ? 'border-primary-400 bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-primary-500'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-3">Estilo visual da capa</h2>
                <div className="flex flex-wrap gap-2">
                  {visualStyles.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setVisualStyle(style)}
                      className={`rounded-full border px-4 py-2 text-sm transition-all ${
                        visualStyle === style
                          ? 'border-purple-300 bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-500'
                      }`}
                    >
                      {style}
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
                {generating ? 'Criando sua arte...' : '✨ Gerar Capa'}
              </button>

              {(status?.remaining || 0) <= 0 && (
                <p className="mt-4 text-center text-sm text-yellow-300">
                  Você atingiu o limite mensal. Em breve teremos upgrades para ampliar gerações.
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
                    <h3 className="text-2xl font-bold mb-2">Criando sua arte...</h3>
                    <p className="text-gray-400">Interpretando emoção, clima e identidade musical.</p>
                  </div>
                ) : currentCover?.imageUrl ? (
                  <>
                    <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-purple-950/40">
                      <img
                        src={currentCover.imageUrl}
                        alt={currentCover.title || 'Capa gerada com IA'}
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
                      <h3 className="text-xl font-bold">{currentCover.title || title || 'Capa gerada'}</h3>
                      <p className="text-sm text-gray-400">
                        {currentCover.musicStyle} · {currentCover.visualStyle}
                      </p>
                    </div>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleDownload(currentCover)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm hover:bg-gray-700"
                      >
                        <FiDownload /> Baixar PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerate(true)}
                        disabled={generating || (status?.remaining || 0) <= 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm hover:bg-primary-600 disabled:opacity-60"
                      >
                        <FiRefreshCw /> Variação
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(currentCover)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-sm hover:bg-purple-600"
                      >
                        <FiShare2 /> Compartilhar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-3xl border border-dashed border-gray-700 bg-gray-900/70">
                      <FiImage className="h-16 w-16 text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Sua capa aparecerá aqui</h3>
                    <p className="text-gray-400">
                      Escreva a letra ou descreva a música para a IA criar uma arte premium.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Biblioteca de capas</h2>
                  <FiClock className="text-primary-300" />
                </div>
                {status?.history?.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {status.history.map((cover) => (
                      <button
                        key={cover.id}
                        type="button"
                        onClick={() => setCurrentCover(cover)}
                        className="group text-left"
                      >
                        {cover.imageUrl ? (
                          <img
                            src={cover.imageUrl}
                            alt={cover.title || 'Capa gerada'}
                            className="aspect-square w-full rounded-xl object-cover ring-1 ring-gray-800 transition-all group-hover:ring-primary-400"
                          />
                        ) : (
                          <div className="aspect-square rounded-xl bg-gray-900 ring-1 ring-gray-800" />
                        )}
                        <p className="mt-2 truncate text-sm font-medium">{cover.title || 'Sem título'}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(cover.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    As capas geradas ficarão salvas aqui para baixar novamente.
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
