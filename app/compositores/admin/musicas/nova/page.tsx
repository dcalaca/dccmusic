'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MusicForm from '@/components/admin/MusicForm'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import FeaturedOfferModal from '@/components/FeaturedOfferModal'

export default function NewComposerMusicPage() {
  const router = useRouter()
  const [composer, setComposer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login')
      return
    }

    const validateAccess = async () => {
      try {
        const cachedComposer = JSON.parse(composerData)
        const response = await fetch('/api/compositores/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (response.status === 401) {
          localStorage.removeItem('composer_token')
          localStorage.removeItem('composer_data')
          router.push('/compositores/login')
          return
        }

        const data = response.ok ? await response.json() : null
        const serverComposer = data?.composer
        const hasCatalogAccess = Boolean(
          serverComposer?.isPremium ||
          serverComposer?.hasActiveSubscription ||
          data?.plan?.status === 'active'
        )

        if (!hasCatalogAccess) {
          router.push('/compositores/admin/musicas')
          return
        }

        const currentComposer = {
          ...cachedComposer,
          id: serverComposer?.id || cachedComposer.id,
          name: serverComposer?.name || cachedComposer.name,
          slug: serverComposer?.slug || cachedComposer.slug,
          email: serverComposer?.email || cachedComposer.email,
          isPremium: Boolean(serverComposer?.isPremium || serverComposer?.hasActiveSubscription || cachedComposer.isPremium),
          hasActiveSubscription: Boolean(serverComposer?.hasActiveSubscription || cachedComposer.hasActiveSubscription),
        }

        localStorage.setItem('composer_data', JSON.stringify(currentComposer))
        setComposer(currentComposer)
      } catch (error) {
        router.push('/compositores/login')
      } finally {
        setLoading(false)
      }
    }

    validateAccess()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (!composer || !(composer.isPremium || composer.hasActiveSubscription)) {
    return null
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
              <span className="gradient-text">Nova Música</span>
            </h1>
            <p className="text-gray-400">
              Cadastre uma música do Spotify, SoundCloud, Apple Music ou outro player externo.
            </p>
          </div>
          <ComposerMusicForm composerId={composer.id} composerName={composer.name} />
        </div>
      </div>
    </div>
  )
}

// Componente wrapper que adapta o MusicForm para compositores
function ComposerMusicForm({ composerId, composerName }: { composerId: string; composerName: string }) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    genre: '',
    spotifyUrl: '',
    spotifyEmbed: '',
    tags: '',
    description: '',
    publishedAt: new Date().toISOString().split('T')[0],
  })
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedComposers, setSelectedComposers] = useState<string[]>([composerName]) // Incluir o compositor logado por padrão
  const [composers, setComposers] = useState<Array<{ id: string; name: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredComposers, setFilteredComposers] = useState<Array<{ id: string; name: string }>>([])
  const [showComposerList, setShowComposerList] = useState(false)
  const [loadingComposers, setLoadingComposers] = useState(false)
  const [showFeaturedOffer, setShowFeaturedOffer] = useState(false)
  const [savedMusicId, setSavedMusicId] = useState<string | null>(null)
  const [savedMusicTitle, setSavedMusicTitle] = useState<string>('')

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
    // Não permitir remover o compositor logado se for o único
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
      if (!token) {
        localStorage.removeItem('composer_data')
        router.push('/compositores/login')
        return
      }
      
      // Criar slug se não existir
      const slug = formData.slug || formData.title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      const response = await fetch('/api/compositores/musicas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          slug,
          composers: selectedComposers, // Usar compositores selecionados
        }),
      })

      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('composer_token')
        localStorage.removeItem('composer_data')
        throw new Error('Sua sessão expirou. Faça login novamente para cadastrar a música.')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar música')
      }

      // Mostrar modal de oferta de destaque
      if (data.music) {
        setSavedMusicId(data.music.id)
        setSavedMusicTitle(data.music.title)
        setShowFeaturedOffer(true)
      } else {
        router.push('/compositores/admin/musicas')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar música')
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
          placeholder="Spotify, SoundCloud, Apple Music ou outro link da música"
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Código para incorporar ou link do player</label>
        <textarea
          value={formData.spotifyEmbed}
          onChange={(e) => setFormData({ ...formData, spotifyEmbed: e.target.value })}
          placeholder="Cole o código do Spotify, SoundCloud, Apple Music ou outro player. Para SoundCloud, pode colar o link da faixa."
          rows={4}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Dica: se a plataforma oferecer um código para incorporar, cole o código inteiro aqui. Para SoundCloud, prefira iframe com width="100%" e height="300".
        </p>
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
        
        {/* Compositores selecionados */}
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

        {/* Busca de compositores */}
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
              // Delay para permitir clicar nos itens da lista
              setTimeout(() => setShowComposerList(false), 200)
            }}
            placeholder="Buscar compositor ou criar novo..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
          />
          
          {/* Lista de compositores */}
          {showComposerList && searchQuery.trim() && filteredComposers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredComposers.map((composer) => (
                <button
                  key={composer.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Prevenir blur do input
                  onClick={() => handleSelectComposer(composer.name)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors text-sm"
                >
                  {composer.name}
                </button>
              ))}
            </div>
          )}
          
          {/* Opção de criar novo */}
          {showComposerList && searchQuery.trim() && 
           !composers.some(c => c.name.toLowerCase() === searchQuery.toLowerCase()) &&
           !selectedComposers.includes(searchQuery.trim()) && (
            <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // Prevenir blur do input
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
          {loading ? 'Salvando...' : 'Salvar Música'}
        </button>
        <Link
          href="/compositores/admin/musicas"
          className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancelar
        </Link>
      </div>

      {showFeaturedOffer && savedMusicId && (
        <FeaturedOfferModal
          contentType="music"
          contentId={savedMusicId}
          contentTitle={savedMusicTitle}
          composerId={composerId}
          onClose={() => {
            setShowFeaturedOffer(false)
            router.push('/compositores/admin/musicas')
          }}
        />
      )}
    </form>
  )
}
