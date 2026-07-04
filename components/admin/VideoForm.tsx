'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { slugify, extractYoutubeId } from '@/lib/utils'
import { FiLoader } from 'react-icons/fi'
import ComposerSelector from './ComposerSelector'

interface VideoFormProps {
  video?: {
    id: string
    title: string
    slug: string
    youtubeUrl: string
    youtubeId: string
    youtubeEmbed?: string | null
    genre?: string | null
    tags?: string | null
    description?: string | null
    publishedAt: Date
    featured: boolean
    thumbnailUrl?: string | null
    duration?: string | null
    composers?: Array<{ id: string; name: string }>
  }
  initialComposers?: string[]
}

export default function VideoForm({ video, initialComposers = [] }: VideoFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([])
  const [loadingGenres, setLoadingGenres] = useState(true)
  const [isNewGenre, setIsNewGenre] = useState(false)
  const [selectedComposers, setSelectedComposers] = useState<string[]>(
    video?.composers?.map(c => c.name) || initialComposers
  )
  const [formData, setFormData] = useState({
    title: video?.title || '',
    slug: video?.slug || '',
    youtubeUrl: video?.youtubeUrl || '',
    youtubeEmbed: video?.youtubeEmbed || '',
    genre: video?.genre || '',
    tags: video?.tags || '',
    description: video?.description || '',
    publishedAt: video?.publishedAt ? new Date(video.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    featured: video?.featured || false,
    thumbnailUrl: video?.thumbnailUrl || '',
    duration: video?.duration || '',
  })

  useEffect(() => {
    // Buscar gêneros disponíveis
    const fetchGenres = async () => {
      try {
        const res = await fetch('/api/admin/generos/list')
        if (res.ok) {
          const data = await res.json()
          setGenres(data)
        }
      } catch (error) {
        console.error('Erro ao buscar gêneros:', error)
      } finally {
        setLoadingGenres(false)
      }
    }
    fetchGenres()
  }, [])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setFormData({
      ...formData,
      title,
      slug: video ? formData.slug : slugify(title),
    })
  }

  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    const videoId = extractYoutubeId(url)
    setFormData({
      ...formData,
      youtubeUrl: url,
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : formData.thumbnailUrl,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const youtubeId = extractYoutubeId(formData.youtubeUrl)
      if (!youtubeId) {
        alert('URL do YouTube inválida')
        setLoading(false)
        return
      }

      const url = video ? `/api/admin/videos/${video.id}` : '/api/admin/videos'
      const method = video ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          youtubeId,
          publishedAt: new Date(formData.publishedAt).toISOString(),
          composers: selectedComposers,
        }),
      })

      if (res.ok) {
        router.push('/admin/videos')
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar vídeo')
      }
    } catch (error) {
      alert('Erro ao salvar vídeo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Título *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={handleTitleChange}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="slug" className="block text-sm font-medium mb-2">
              Slug *
            </label>
            <input
              id="slug"
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="youtubeUrl" className="block text-sm font-medium mb-2">
              URL do YouTube *
            </label>
            <input
              id="youtubeUrl"
              type="url"
              value={formData.youtubeUrl}
              onChange={handleYoutubeUrlChange}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="youtubeEmbed" className="block text-sm font-medium mb-2">
              Código de Embed do YouTube (iframe)
            </label>
            <textarea
              id="youtubeEmbed"
              value={formData.youtubeEmbed}
              onChange={(e) => setFormData({ ...formData, youtubeEmbed: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 font-mono text-sm"
              placeholder='<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" ...></iframe>'
            />
            <p className="text-xs text-gray-400 mt-1">
              Cole aqui o código iframe completo do YouTube. Se preenchido, será usado em vez da URL padrão.
            </p>
          </div>

          <div>
            <label htmlFor="genre" className="block text-sm font-medium mb-2">
              Gênero *
            </label>
            {loadingGenres ? (
              <div className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                Carregando gêneros...
              </div>
            ) : isNewGenre ? (
              <div>
                <input
                  type="text"
                  id="genre"
                  value={formData.genre}
                  placeholder="Digite o novo gênero"
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsNewGenre(false)
                    setFormData({ ...formData, genre: '' })
                  }}
                  className="mt-2 text-sm text-gray-400 hover:text-gray-300"
                >
                  ← Voltar para seleção
                </button>
              </div>
            ) : (
              <div>
                <select
                  id="genre"
                  value={formData.genre}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsNewGenre(true)
                      setFormData({ ...formData, genre: '' })
                    } else {
                      setFormData({ ...formData, genre: e.target.value })
                    }
                  }}
                  required={!isNewGenre}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                >
                  <option value="">Selecione um gênero</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.name}>
                      {genre.name}
                    </option>
                  ))}
                  <option value="__new__">+ Novo gênero</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="publishedAt" className="block text-sm font-medium mb-2">
              Data de Publicação *
            </label>
            <input
              id="publishedAt"
              type="date"
              value={formData.publishedAt}
              onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium mb-2">
              Duração
            </label>
            <input
              id="duration"
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="3:45"
            />
          </div>

          <div>
            <label htmlFor="thumbnailUrl" className="block text-sm font-medium mb-2">
              URL da Thumbnail
            </label>
            <input
              id="thumbnailUrl"
              type="url"
              value={formData.thumbnailUrl}
              onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Gerado automaticamente a partir da URL do YouTube"
            />
            {formData.thumbnailUrl && (
              <div className="mt-2">
                <img
                  src={formData.thumbnailUrl}
                  alt="Preview thumbnail"
                  className="w-full max-w-xs rounded-lg border border-gray-700"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <ComposerSelector
              selectedComposers={selectedComposers}
              onChange={setSelectedComposers}
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 text-primary-600 bg-gray-800 border-gray-700 rounded focus:ring-primary-500"
              />
              <span>Destaque</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="tags" className="block text-sm font-medium mb-2">
              Tags (separadas por vírgula)
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <FiLoader className="w-5 h-5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
