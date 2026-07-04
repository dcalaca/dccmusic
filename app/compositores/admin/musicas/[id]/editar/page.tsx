'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'

export default function EditComposerMusicPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [composer, setComposer] = useState<any>(null)
  const [music, setMusic] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login')
      return
    }

    try {
      const data = JSON.parse(composerData)
      setComposer(data)

      if (!data.isPremium) {
        router.push('/compositores/planos')
        return
      }

      loadMusic(params.id, data.id)
    } catch (error) {
      router.push('/compositores/login')
    }
  }, [router, params.id])

  const loadMusic = async (musicId: string, composerId: string) => {
    try {
      const token = localStorage.getItem('composer_token')
      // Buscar a música diretamente com compositores incluídos
      const response = await fetch(`/api/compositores/musicas/${musicId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.music) {
          console.log('[PAGE] Música carregada com compositores:', {
            id: data.music.id,
            title: data.music.title,
            composers: data.music.composers?.map((c: any) => c.name) || []
          })
          setMusic(data.music)
        } else {
          console.error('Música não encontrada na resposta')
        }
      } else {
        const errorData = await response.json()
        console.error('Erro ao carregar música:', errorData)
      }
    } catch (error) {
      console.error('Erro ao carregar música:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (!composer || !composer.isPremium) {
    return null
  }

  if (!music) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/compositores/admin/musicas"
              className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-6"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-red-300">
                Música não encontrada
              </h2>
              <p className="text-gray-400 mb-6">
                A música que você está tentando editar não foi encontrada ou você não tem permissão para editá-la.
              </p>
              <Link
                href="/compositores/admin/musicas"
                className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-medium"
              >
                Voltar para Minhas Músicas
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
        <div className="max-w-4xl mx-auto">
          <Link
            href="/compositores/admin/musicas"
            className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-6"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Link>
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Editar Música</span>
            </h1>
            <p className="text-gray-400">
              Edite as informações da música
            </p>
          </div>
          <ComposerMusicForm 
            music={music} 
            composerId={composer.id} 
            composerName={composer.name} 
          />
        </div>
      </div>
    </div>
  )
}

// Componente wrapper que adapta o MusicForm para compositores
function ComposerMusicForm({ 
  music, 
  composerId, 
  composerName 
}: { 
  music: any
  composerId: string
  composerName: string 
}) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: music.title || '',
    slug: music.slug || '',
    genre: music.genre || '',
    spotifyUrl: music.spotifyUrl || '',
    spotifyEmbed: music.spotifyEmbed || '',
    appleMusicUrl: music.appleMusicUrl || '',
    appleMusicEmbed: music.appleMusicEmbed || '',
    tags: music.tags || '',
    description: music.description || '',
    publishedAt: music.publishedAt ? new Date(music.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  })
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedComposers, setSelectedComposers] = useState<string[]>(
    music.composers?.map((c: any) => c.name) || [composerName]
  )
  const [composers, setComposers] = useState<Array<{ id: string; name: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredComposers, setFilteredComposers] = useState<Array<{ id: string; name: string }>>([])
  const [showComposerList, setShowComposerList] = useState(false)
  const [loadingComposers, setLoadingComposers] = useState(false)

  useEffect(() => {
    fetchGenres()
    loadComposers()
  }, [])

  // Filtrar compositores conforme o usuário digita
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = composers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !selectedComposers.includes(c.name)
      )
      setFilteredComposers(filtered)
      setShowComposerList(true)
    } else {
      setFilteredComposers(composers.filter(c => !selectedComposers.includes(c.name)).slice(0, 10))
      setShowComposerList(false)
    }
  }, [searchQuery, composers, selectedComposers])

  const loadComposers = async () => {
    setLoadingComposers(true)
    try {
      const token = localStorage.getItem('composer_token')
      if (!token) {
        router.push('/compositores/login')
        return
      }

      const response = await fetch('/api/compositores/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        localStorage.removeItem('composer_data')
        router.push('/compositores/login')
        return
      }

      if (!response.ok) {
        console.error('Erro ao carregar compositores:', response.status, response.statusText)
        return
      }

      const data = await response.json()
      const allComposers: Array<{ id: string; name: string }> = (data.composers || []).map((c: any) => ({ id: c.id, name: c.name }))
      
      setComposers(allComposers)
      setFilteredComposers(allComposers.filter(c => !selectedComposers.includes(c.name)).slice(0, 10))
    } catch (err) {
      console.error('Erro ao carregar compositores:', err)
    } finally {
      setLoadingComposers(false)
    }
  }

  const handleSelectComposer = (composerName: string) => {
    if (!selectedComposers.includes(composerName)) {
      setSelectedComposers([...selectedComposers, composerName])
      setSearchQuery('')
      setShowComposerList(false)
    }
  }

  const handleRemoveComposer = (composerNameToRemove: string) => {
    if (selectedComposers.length === 1 && composerNameToRemove === composerName) {
      return
    }
    setSelectedComposers(selectedComposers.filter(c => c !== composerNameToRemove))
  }

  const handleCreateNewComposer = () => {
    const newComposerName = searchQuery.trim()
    if (newComposerName && !selectedComposers.includes(newComposerName)) {
      setSelectedComposers([...selectedComposers, newComposerName])
      setSearchQuery('')
      setShowComposerList(false)
    }
  }

  const fetchGenres = async () => {
    try {
      const response = await fetch('/api/generos/list')
      if (response.ok) {
        const data = await response.json()
        setGenres(data.map((g: any) => g.name))
      } else {
        console.error('Erro ao buscar gêneros:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao buscar gêneros:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('composer_token')
      
      const slug = formData.slug || formData.title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      const response = await fetch(`/api/compositores/musicas/${music.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          slug,
          composers: selectedComposers,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar música')
      }

      router.push('/compositores/admin/musicas')
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar música')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Título *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Slug</label>
        <input
          type="text"
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          placeholder="Será gerado automaticamente se vazio"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Gênero</label>
        <select
          value={formData.genre}
          onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        >
          <option value="">Selecione um gênero</option>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">URL da música</label>
        <input
          type="url"
          value={formData.spotifyUrl}
          onChange={(e) => setFormData({ ...formData, spotifyUrl: e.target.value })}
          placeholder="Spotify, SoundCloud ou Apple Music"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Código de embed ou link do player</label>
        <textarea
          value={formData.spotifyEmbed}
          onChange={(e) => setFormData({ ...formData, spotifyEmbed: e.target.value })}
          placeholder="Cole o iframe do Spotify, SoundCloud ou Apple Music. Para SoundCloud, pode colar o link da faixa."
          rows={4}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Dica para SoundCloud: prefira iframe com width="100%" e height="300". Esse tamanho costuma encaixar melhor no site.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">URL do Apple Music</label>
        <input
          type="url"
          value={formData.appleMusicUrl}
          onChange={(e) => setFormData({ ...formData, appleMusicUrl: e.target.value })}
          placeholder="https://music.apple.com/..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Embed do Apple Music</label>
        <textarea
          value={formData.appleMusicEmbed}
          onChange={(e) => setFormData({ ...formData, appleMusicEmbed: e.target.value })}
          placeholder="Cole o código iframe do Apple Music"
          rows={4}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Tags (separadas por vírgula)</label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="tag1, tag2, tag3"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Descrição / Letra</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={8}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Data de Publicação</label>
        <input
          type="date"
          value={formData.publishedAt}
          onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Seleção de Compositores */}
      <div>
        <label className="block text-sm font-medium mb-2">Compositores *</label>
        
        {selectedComposers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedComposers.map((composer) => (
              <span
                key={composer}
                className="inline-flex items-center gap-2 px-3 py-1 bg-primary-600/20 text-primary-300 border border-primary-800 rounded-lg text-sm"
              >
                {composer}
                {selectedComposers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveComposer(composer)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) {
                setShowComposerList(true)
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowComposerList(false), 200)
            }}
            placeholder="Buscar compositor ou criar novo..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
          />
          
          {showComposerList && searchQuery.trim() && filteredComposers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredComposers.map((composer) => (
                <button
                  key={composer.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectComposer(composer.name)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors text-sm"
                >
                  {composer.name}
                </button>
              ))}
            </div>
          )}
          
          {showComposerList && searchQuery.trim() && 
           !composers.some(c => c.name.toLowerCase() === searchQuery.toLowerCase()) &&
           !selectedComposers.includes(searchQuery.trim()) && (
            <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreateNewComposer}
                className="w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors text-sm text-primary-400"
              >
                + Criar novo: "{searchQuery.trim()}"
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
        <Link
          href="/compositores/admin/musicas"
          className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
