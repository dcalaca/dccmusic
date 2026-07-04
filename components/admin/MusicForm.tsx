'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { FiLoader } from 'react-icons/fi'
import ComposerSelector from './ComposerSelector'

interface MusicFormProps {
  music?: {
    id: string
    title: string
    slug: string
    genre?: string | null
    spotifyUrl?: string | null
    spotifyEmbed?: string | null
    tags?: string | null
    description?: string | null
    coverUrl?: string | null
    featured: boolean
    publishedAt: Date
    composers?: Array<{ id: string; name: string }>
  }
  initialComposers?: string[]
}

export default function MusicForm({ music, initialComposers = [] }: MusicFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([])
  const [loadingGenres, setLoadingGenres] = useState(true)
  const [isNewGenre, setIsNewGenre] = useState(false)
  const [selectedComposers, setSelectedComposers] = useState<string[]>(
    music?.composers?.map(c => c.name) || initialComposers
  )
  const [formData, setFormData] = useState({
    title: music?.title || '',
    slug: music?.slug || '',
    genre: music?.genre || '',
    spotifyUrl: music?.spotifyUrl || '',
    spotifyEmbed: music?.spotifyEmbed || '',
    tags: music?.tags || '',
    description: music?.description || '',
    coverUrl: music?.coverUrl || '',
    featured: music?.featured || false,
    publishedAt: music?.publishedAt ? new Date(music.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
      slug: music ? formData.slug : slugify(title),
    })
  }

  // Função para detectar se um texto é um código de embed
  const isEmbedCode = (text: string): boolean => {
    if (!text || typeof text !== 'string') return false
    const trimmed = text.trim()
    // Aceita iframes e links de plataformas que o player consegue montar automaticamente.
    return (
      trimmed.startsWith('<iframe') ||
      trimmed.startsWith('<IFRAME') ||
      (trimmed.includes('<iframe') && trimmed.includes('src=')) ||
      (trimmed.includes('open.spotify.com/embed') && trimmed.includes('<iframe')) ||
      /^https?:\/\/(www\.)?soundcloud\.com\//i.test(trimmed) ||
      /^https?:\/\/music\.apple\.com\//i.test(trimmed)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Detectar se código de embed foi colocado no campo errado
      let finalFormData = { ...formData }
      
      // Se descrição contém código de embed e spotifyEmbed está vazio, mover
      if (isEmbedCode(formData.description) && !formData.spotifyEmbed) {
        finalFormData.spotifyEmbed = formData.description.trim()
        finalFormData.description = ''
        alert('Código de embed detectado na descrição e movido para o campo correto!')
      }
      
      // Se spotifyEmbed contém código de embed mas descrição também tem, limpar descrição
      if (isEmbedCode(formData.spotifyEmbed) && isEmbedCode(formData.description)) {
        finalFormData.description = ''
        alert('Código de embed removido da descrição (já está no campo correto).')
      }

      const url = music ? `/api/admin/musicas/${music.id}` : '/api/admin/musicas'
      const method = music ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...finalFormData,
          publishedAt: new Date(finalFormData.publishedAt).toISOString(),
          composers: selectedComposers,
        }),
      })

      if (res.ok) {
        router.push('/admin/musicas')
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar música')
      }
    } catch (error) {
      alert('Erro ao salvar música')
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

          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Plataforma de áudio</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="spotifyUrl" className="block text-sm font-medium mb-2">
                  URL da música
                </label>
                <input
                  id="spotifyUrl"
                  type="url"
                  value={formData.spotifyUrl}
                  onChange={(e) => setFormData({ ...formData, spotifyUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                  placeholder="Spotify, SoundCloud ou Apple Music"
                />
              </div>
              <div>
                <label htmlFor="spotifyEmbed" className="block text-sm font-medium mb-2">
                  Código de embed ou link do player
                  {formData.spotifyEmbed && !isEmbedCode(formData.spotifyEmbed) && (
                    <span className="ml-2 text-red-400 text-xs">
                      ⚠️ Não parece ser um código de embed válido
                    </span>
                  )}
                </label>
                <textarea
                  id="spotifyEmbed"
                  value={formData.spotifyEmbed}
                  onChange={(e) => setFormData({ ...formData, spotifyEmbed: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:border-primary-500 font-mono text-sm ${
                    formData.spotifyEmbed && !isEmbedCode(formData.spotifyEmbed)
                      ? 'border-red-500 border-2'
                      : 'border-gray-700'
                  }`}
                  placeholder='<iframe src="https://open.spotify.com/embed/..."></iframe> ou link do SoundCloud'
                />
                <p className="mt-1 text-xs text-gray-400">
                  💡 Aceita iframe do Spotify, SoundCloud ou Apple Music. Para SoundCloud, também pode colar o link da faixa.
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Dica para SoundCloud: prefira iframe com width="100%" e height="300". Esse tamanho costuma encaixar melhor no site.
                </p>
              </div>
            </div>
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
              Descrição / Letra
              {formData.description && isEmbedCode(formData.description) && (
                <span className="ml-2 text-yellow-400 text-xs">
                  ⚠️ Código de embed detectado! Será movido para o campo correto ao salvar.
                </span>
              )}
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className={`w-full px-4 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:border-primary-500 ${
                formData.description && isEmbedCode(formData.description)
                  ? 'border-yellow-500 border-2'
                  : 'border-gray-700'
              }`}
              placeholder="Digite a descrição ou letra da música aqui..."
            />
            {formData.description && isEmbedCode(formData.description) && (
              <p className="mt-2 text-xs text-yellow-400">
                💡 Dica: Códigos de embed começam com &lt;iframe e devem ser colocados no campo "Código de Embed do Spotify" acima.
              </p>
            )}
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
