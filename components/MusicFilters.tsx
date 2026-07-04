'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiX, FiFilter } from 'react-icons/fi'

interface MusicFiltersProps {
  genres: Array<{ id: string; name: string; slug: string; count?: number }>
  currentParams: {
    genero?: string | string[]
    plataforma?: string
    ordem?: string
    busca?: string
  }
}

export default function MusicFilters({ genres, currentParams }: MusicFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // Inicializar estados da URL - se não há gêneros na URL, não selecionar nenhum (mostrar todos)
  const getGenresFromParams = () => {
    const generoParam = searchParams.getAll('genero')
    return generoParam.length > 0 ? generoParam : []
  }
  
  const [selectedGenres, setSelectedGenres] = useState<string[]>(getGenresFromParams())
  const [plataforma, setPlataforma] = useState(searchParams.get('plataforma') || '')
  const [ordem, setOrdem] = useState(searchParams.get('ordem') || 'mais-vistos')
  const [busca, setBusca] = useState(searchParams.get('busca') || '')
  const [buscaDebounced, setBuscaDebounced] = useState(searchParams.get('busca') || '')
  const isInitialMount = useRef(true)
  const buscaTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Debounce para busca
  useEffect(() => {
    if (buscaTimeoutRef.current) {
      clearTimeout(buscaTimeoutRef.current)
    }
    
    buscaTimeoutRef.current = setTimeout(() => {
      setBuscaDebounced(busca)
    }, 500)
    
    return () => {
      if (buscaTimeoutRef.current) {
        clearTimeout(buscaTimeoutRef.current)
      }
    }
  }, [busca])
  
  // Sincronizar com URL
  useEffect(() => {
    const generoParam = searchParams.getAll('genero')
    setSelectedGenres(generoParam.length > 0 ? generoParam : [])
    setPlataforma(searchParams.get('plataforma') || '')
    setOrdem(searchParams.get('ordem') || 'mais-vistos')
    const buscaParam = searchParams.get('busca') || ''
    setBusca(buscaParam)
    setBuscaDebounced(buscaParam)
  }, [searchParams])
  
  // Aplicar filtros na URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const params = new URLSearchParams()
    
    // Ao mudar filtros, a paginação deve voltar para a primeira página.
    // Preservar apenas a visualização (lista/grade).
    const visualizacao = searchParams.get('visualizacao')
    if (visualizacao) {
      params.set('visualizacao', visualizacao)
    }
    
    // Gêneros - só adicionar na URL se houver seleção
    if (selectedGenres.length > 0) {
      selectedGenres.forEach((g) => params.append('genero', g))
    }
    if (plataforma) {
      params.set('plataforma', plataforma)
    }
    if (ordem && ordem !== 'mais-vistos') {
      params.set('ordem', ordem)
    }
    if (buscaDebounced && buscaDebounced.trim() !== '') {
      params.set('busca', buscaDebounced.trim())
    }

    router.push(`/musicas?${params.toString()}`, { scroll: false })
  }, [selectedGenres, plataforma, ordem, buscaDebounced, router, searchParams, genres.length])

  const toggleGenre = (genreName: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreName) ? prev.filter((g) => g !== genreName) : [...prev, genreName]
    )
  }


  const deselectAllGenres = () => {
    setSelectedGenres([])
  }

  const clearFilters = () => {
    setSelectedGenres([])
    setPlataforma('')
    setOrdem('mais-vistos')
    setBusca('')
    router.push('/musicas')
    setIsMobileOpen(false)
  }

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Busca */}
      <div>
        <label className="block text-sm font-medium mb-2">Buscar</label>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Título, tags..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Gêneros */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Gêneros</label>
          <button
            onClick={deselectAllGenres}
            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            Nenhum
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {genres.map((genre) => (
            <label
              key={genre.id}
              className="flex items-center space-x-2 cursor-pointer hover:text-primary-400 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedGenres.includes(genre.name)}
                onChange={() => toggleGenre(genre.name)}
                className="w-4 h-4 text-primary-600 bg-gray-800 border-gray-700 rounded focus:ring-primary-500"
              />
              <span className="text-sm">
                {genre.name}
                {genre.count !== undefined && (
                  <span className="text-gray-500 ml-1">({genre.count})</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Plataforma */}
      <div>
        <label className="block text-sm font-medium mb-2">Plataforma</label>
        <select
          value={plataforma}
          onChange={(e) => setPlataforma(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        >
          <option value="">Todas</option>
          <option value="spotify">Spotify</option>
        </select>
      </div>

      {/* Ordem */}
      <div>
        <label className="block text-sm font-medium mb-2">Ordenar por</label>
        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
        >
          <option value="mais-vistos">Mais vistos</option>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="az">A-Z</option>
        </select>
      </div>

      {/* Botões */}
      <div className="flex flex-col space-y-2">
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
        >
          Fechar
        </button>
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Limpar
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile: Botão para abrir drawer */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-between mb-4"
      >
        <span className="flex items-center space-x-2">
          <FiFilter className="w-5 h-5" />
          <span>Filtros</span>
        </span>
        {(selectedGenres.length > 0 || plataforma || ordem !== 'mais-vistos' || busca) && (
          <span className="px-2 py-1 bg-primary-600 rounded text-xs">
            {(selectedGenres.length > 0 ? 1 : 0) + (plataforma ? 1 : 0) + (ordem !== 'mais-vistos' ? 1 : 0) + (busca ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Desktop: Sidebar sempre visível */}
      <div className="hidden lg:block bg-gray-900/50 p-6 rounded-lg border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <FiltersContent />
      </div>

      {/* Mobile: Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Filtros</h2>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <FiltersContent />
          </div>
        </div>
      )}
    </>
  )
}
