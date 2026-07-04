'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiFilter, FiX, FiSearch, FiSliders } from 'react-icons/fi'

interface ComposerFiltersProps {
  genres: Array<{ id: string; name: string; slug: string }>
}

export default function ComposerFilters({ genres }: ComposerFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  const [tipo, setTipo] = useState<'todos' | 'videos' | 'musicas'>(searchParams.get('tipo') as 'todos' | 'videos' | 'musicas' || 'todos')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    const generoParam = searchParams.getAll('genero')
    return generoParam.length > 0 ? generoParam : []
  })
  const [ordem, setOrdem] = useState<'mais-vistos' | 'recentes' | 'az'>(searchParams.get('ordem') as 'mais-vistos' | 'recentes' | 'az' || 'mais-vistos')
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

  // Aplicar filtros automaticamente
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const params = new URLSearchParams()
    
    if (tipo !== 'todos') {
      params.set('tipo', tipo)
    }
    if (selectedGenres.length > 0) {
      selectedGenres.forEach((g) => params.append('genero', g))
    }
    if (ordem !== 'mais-vistos') {
      params.set('ordem', ordem)
    }
    if (buscaDebounced && buscaDebounced.trim() !== '') {
      params.set('busca', buscaDebounced.trim())
    }

    const currentPath = window.location.pathname
    const url = `${currentPath}${params.toString() ? `?${params.toString()}` : ''}`
    router.push(url)
  }, [tipo, selectedGenres, ordem, buscaDebounced, router])

  const toggleGenre = (genreName: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreName)
        ? prev.filter((g) => g !== genreName)
        : [...prev, genreName]
    )
  }

  const clearFilters = () => {
    setTipo('todos')
    setSelectedGenres([])
    setOrdem('mais-vistos')
    setBusca('')
    router.push(window.location.pathname)
    setIsMobileOpen(false)
  }

  const hasActiveFilters = tipo !== 'todos' || selectedGenres.length > 0 || ordem !== 'mais-vistos' || busca.trim() !== ''

  return (
    <>
      {/* Botão Mobile */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors w-full"
        >
          <FiSliders className="text-primary-400" />
          <span className="text-sm">Filtros</span>
          {hasActiveFilters && (
            <span className="ml-auto px-2 py-0.5 bg-primary-600 rounded-full text-xs">
              {[tipo !== 'todos' ? 1 : 0, selectedGenres.length, ordem !== 'mais-vistos' ? 1 : 0, busca.trim() ? 1 : 0].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filtros Desktop */}
      <div className="hidden lg:block mb-8">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          {/* Busca */}
          <div className="mb-6">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar obras..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
              <div className="flex gap-2">
                {(['todos', 'videos', 'musicas'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tipo === t
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t === 'todos' ? 'Todos' : t === 'videos' ? 'Vídeos' : 'Músicas'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gêneros */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Gênero</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre.name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedGenres.includes(genre.name)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenação */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ordenar por</label>
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as 'mais-vistos' | 'recentes' | 'az')}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              >
                <option value="mais-vistos">Mais vistos</option>
                <option value="recentes">Mais Recentes</option>
                <option value="az">A-Z</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <FiX />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Mobile */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-gray-900 border-l border-gray-800 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Filtros</h2>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Busca */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar obras..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Tipo */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                <div className="flex flex-col gap-2">
                  {(['todos', 'videos', 'musicas'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipo(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                        tipo === t
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {t === 'todos' ? 'Todos' : t === 'videos' ? 'Vídeos' : 'Músicas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gêneros */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Gênero</label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.name)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedGenres.includes(genre.name)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ordenação */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Ordenar por</label>
                <select
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value as 'mais-vistos' | 'recentes' | 'az')}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="mais-vistos">Mais vistos</option>
                  <option value="recentes">Mais Recentes</option>
                  <option value="az">A-Z</option>
                </select>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="flex-1 px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
