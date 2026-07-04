'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiCreditCard, FiDownload, FiImage, FiLoader, FiUploadCloud, FiZap } from 'react-icons/fi'

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

const selectClassName = 'w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500'
const optionClassName = 'bg-gray-950 text-white'
const MAX_COMPRESSED_REFERENCE_BYTES = 2200 * 1024
const REFERENCE_IMAGE_DIMENSIONS = [1800, 1600, 1400]
const REFERENCE_IMAGE_QUALITIES = [0.9, 0.84, 0.76]

async function readApiResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return {
      error: response.status === 413
        ? 'As fotos enviadas ficaram grandes demais. Tente novamente com fotos menores ou mais nítidas do rosto.'
        : text,
    }
  }
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não consegui ler uma das fotos enviadas. Tente enviar JPG ou PNG.'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não consegui otimizar uma das fotos enviadas.'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', quality)
  })
}

async function compressReferenceImage(file: File, index: number) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie somente arquivos de imagem em PNG, JPG ou WEBP.')
  }

  const image = await loadImageFromFile(file)

  for (const maxDimension of REFERENCE_IMAGE_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não conseguiu preparar a foto.')
    context.drawImage(image, 0, 0, width, height)

    for (const quality of REFERENCE_IMAGE_QUALITIES) {
      const blob = await canvasToBlob(canvas, quality)
      if (blob.size <= MAX_COMPRESSED_REFERENCE_BYTES) {
        return new File([blob], `referencia-${index + 1}.jpg`, { type: 'image/jpeg' })
      }
    }
  }

  throw new Error('Uma das fotos ainda ficou pesada demais. Use uma foto mais leve, de preferência JPG, com o rosto bem iluminado.')
}

export default function StudioCoverArtPage() {
  const router = useRouter()
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
  }, [])

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
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar criação de capa')
      setCredits(data.credits || credits)
      setOptions(data.options || fallbackOptions)
      setHistory(data.history || [])
      setCurrentCover(data.history?.[0] || null)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar criação de capa')
    } finally {
      setLoading(false)
    }
  }

  const handleReferenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 3) {
      setError('Envie no máximo 3 fotos de referência.')
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
      setError('Envie no máximo 3 fotos de referência.')
      return
    }

    setGenerating(true)
    setError('')
    setMessage(files.length > 0 ? 'Otimizando fotos antes de enviar...' : '')
    try {
      if (files.length > 0) {
        const optimizedFiles = await Promise.all(files.map(compressReferenceImage))
        formData.delete('referenceImages')
        optimizedFiles.forEach((file) => formData.append('referenceImages', file))
      }

      const response = await fetch('/api/compositores/studio/cover-art', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao criar capa')
      setError('')
      setCurrentCover(data.cover)
      setHistory((current) => [data.cover, ...current.filter((cover) => cover.id !== data.cover.id)].slice(0, 24))
      setCredits((current) => ({
        ...current,
        remaining: data.credits?.remaining ?? Math.max(0, current.remaining - current.cost),
        canCreate: (data.credits?.remaining ?? 0) >= selectedQualityOption.credits,
      }))
      setMessage('Capa criada com sucesso.')
      window.dispatchEvent(new Event('studioBalanceChange'))
    } catch (err: any) {
      setMessage('')
      setError(err.message || 'Erro ao criar capa')
    } finally {
      setGenerating(false)
    }
  }

  const selectedQualityOption = options.qualities.find((option) => option.id === selectedQuality) || options.qualities[0]
  const canCreateSelectedQuality = credits.remaining >= selectedQualityOption.credits

  const downloadCover = async (cover: CoverItem | null) => {
    if (!cover?.imageUrl) return
    const response = await fetch(cover.imageUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(cover.title || 'capa-dccmusic').replace(/[^\w-]+/g, '-').toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
            <FiArrowLeft /> Voltar
          </Link>

          <section className="mb-8 overflow-hidden rounded-3xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                  <FiImage /> Capa com IA
                </div>
                <h1 className="text-3xl font-black sm:text-5xl">
                  <span className="gradient-text">Criar Capa</span>
                </h1>
                <p className="mt-3 max-w-2xl text-gray-300">
                  Envie até 3 fotos da pessoa como referência ou crie só pelo texto. A IA interpreta seu pedido e cria uma capa profissional com nome da música e cantor.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/45 p-4 sm:p-5">
                <p className="text-sm font-bold text-gray-400">Custo da capa</p>
                <p className="mt-1 text-3xl font-black text-green-300">{selectedQualityOption.credits} créditos</p>
                <p className="mt-1 text-sm text-gray-300">{selectedQualityOption.label}. Quanto maior a qualidade, melhor tende a ficar a semelhança com fotos.</p>
                <p className="mt-3 text-sm text-gray-400">Seu saldo atual: <span className="font-bold text-white">{credits.remaining}</span> créditos</p>
                {!canCreateSelectedQuality && (
                  <Link href="/compositores/admin/studio-ia/recarga" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-bold text-white">
                    <FiCreditCard /> Comprar créditos
                  </Link>
                )}
              </div>
            </div>
          </section>

          {message && <div className="mb-6 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
              <h2 className="mb-5 text-2xl font-black">Descreva sua capa</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Nome da música</span>
                  <input name="songTitle" maxLength={80} placeholder="Opcional. Ex.: Saudade do Sertão" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Cantor</span>
                  <input name="artistName" maxLength={80} placeholder="Opcional. Ex.: João Silva" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Estilo musical</span>
                  <select name="musicStyle" defaultValue="Sertanejo" className={selectClassName}>
                    {options.musicStyles.map((option) => <option key={option} className={optionClassName}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Estilo visual</span>
                  <select name="visualStyle" defaultValue="Moderno" className={selectClassName}>
                    {options.visualStyles.map((option) => <option key={option} className={optionClassName}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Ambiente</span>
                  <select name="environment" defaultValue="Sertão" className={selectClassName}>
                    {options.environments.map((option) => <option key={option} className={optionClassName}>{option}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-gray-300">Tipo de arte</span>
                  <select name="artDirection" defaultValue="Capa de álbum" className={selectClassName}>
                    {options.artDirections.map((option) => <option key={option} className={optionClassName}>{option}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-gray-300">O que você quer na capa?</span>
                <textarea
                  name="userIdea"
                  required
                  minLength={10}
                  rows={6}
                  placeholder="Ex.: Quero o cantor de chapéu olhando para uma estrada de terra ao pôr do sol, clima emocionante, capa de música sertaneja..."
                  className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
                />
                <p className="mt-2 text-xs text-gray-500">Pode escrever simples. A IA vai interpretar e transformar em uma direção visual profissional.</p>
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Qualidade da capa</span>
                <select
                  name="quality"
                  value={selectedQuality}
                  onChange={(event) => setSelectedQuality(event.target.value)}
                  className={selectClassName}
                >
                  {options.qualities.map((option) => (
                    <option key={option.id} value={option.id} className={optionClassName}>
                      {option.label} - {option.credits} créditos
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Para foto de pessoa e letras mais profissionais, a qualidade pró usa mais esforço na arte e na tipografia.
                </p>
              </label>

              <label className="mt-4 block rounded-2xl border border-dashed border-purple-700 bg-purple-950/20 p-4">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100">
                  <FiUploadCloud /> Fotos de referência da pessoa, até 3
                </span>
                <input name="referenceImages" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleReferenceChange} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white" />
                <p className="mt-2 text-xs text-purple-100/80">
                  {referenceCount > 0 ? `${referenceCount} foto(s) selecionada(s).` : 'Opcional. Se não enviar foto, a capa será feita só pelo texto.'}
                </p>
                <p className="mt-1 text-xs text-purple-100/70">
                  Fotos grandes do celular serão otimizadas automaticamente antes do envio.
                </p>
              </label>

              <button disabled={generating || !canCreateSelectedQuality} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 text-lg font-black text-white disabled:opacity-60">
                {generating ? <FiLoader className="animate-spin" /> : <FiZap />}
                {generating ? 'Criando capa...' : `Criar Capa - ${selectedQualityOption.credits} créditos`}
              </button>
            </form>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                <h2 className="mb-4 text-xl font-black">Resultado</h2>
                {currentCover?.imageUrl ? (
                  <div>
                    <img src={currentCover.imageUrl} alt={currentCover.title || 'Capa criada'} className="aspect-square w-full rounded-2xl object-cover" />
                    <button onClick={() => downloadCover(currentCover)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 font-bold hover:bg-gray-700">
                      <FiDownload /> Baixar capa
                    </button>
                  </div>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl border border-gray-800 bg-black/30 text-center text-gray-500">
                    A capa criada aparecerá aqui.
                  </div>
                )}
              </section>

              {history.length > 0 && (
                <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                  <h2 className="mb-4 text-xl font-black">Histórico</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {history.slice(0, 9).map((cover) => (
                      <button key={cover.id} type="button" onClick={() => setCurrentCover(cover)} className="overflow-hidden rounded-xl border border-gray-800 hover:border-primary-500">
                        {cover.imageUrl ? <img src={cover.imageUrl} alt={cover.title || 'Capa'} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-gray-900" />}
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
