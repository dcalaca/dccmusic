'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { FiFilter, FiX } from 'react-icons/fi'

interface AdminVideoFiltersProps {
  genres: Array<{ id: string; name: string; slug: string }>
  anos: number[]
}

export default function AdminVideoFilters({ genres, anos }: AdminVideoFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genero') || '')
  const [selectedAno, setSelectedAno] = useState(searchParams.get('ano') || '')
  const [busca, setBusca] = useState(searchParams.get('busca') || '')
  const [ordem, setOrdem] = useState(searchParams.get('ordem') || 'recentes')
  const [destaque, setDestaque] = useState(searchParams.get('destaque') || '')

  const applyFilters = () => {
    const params = new URLSearchParams()
    
    if (selectedGenre) params.set('genero', selectedGenre)
    if (selectedAno) params.set('ano', selectedAno)
    if (busca.trim()) params.set('busca', busca.trim())
    if (ordem) params.set('ordem', ordem)
    if (destaque) params.set('destaque', destaque)

    router.push(`/admin/videos?${params.toString()}`)
    setIsOpen(false)
  }

  const clearFilters = () => {
    setSelectedGenre('')
    setSelectedAno('')
    setBusca('')
    setOrdem('recentes')
    setDestaque('')
    router.push('/admin/videos')
    setIsOpen(false)
  }

  const hasActiveFilters = selectedGenre || selectedAno || busca.trim() || ordem !== 'recentes' || destaque

  return (
    <>
      {/* Botão para abrir filtros */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
      >
        <FiFilter className="w-5 h-5" />
        <span>Filtros</span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-primary-600 rounded text-xs">
            Ativo
          </span>
        )}
      </button>

      {/* Modal de Filtros */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Filtros</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
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

              {/* Gênero */}
              <div>
                <label className="block text-sm font-medium mb-2">Gênero</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                >
                  <option value="">Todos os gêneros</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.name}>
                      {genre.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ano */}
              <div>
                <label className="block text-sm font-medium mb-2">Ano</label>
                <select
                  value={selectedAno}
                  onChange={(e) => setSelectedAno(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                >
                  <option value="">Todos os anos</option>
                  {anos.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ordenar */}
              <div>
                <label className="block text-sm font-medium mb-2">Ordenar por</label>
                <select
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="antigos">Mais antigos</option>
                  <option value="az">A-Z</option>
                </select>
              </div>

              {/* Destaque */}
              <div>
                <label className="block text-sm font-medium mb-2">Destaque</label>
                <select
                  value={destaque}
                  onChange={(e) => setDestaque(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                >
                  <option value="">Todos</option>
                  <option value="true">Apenas em destaque</option>
                  <option value="false">Sem destaque</option>
                </select>
              </div>

              {/* Botões */}
              <div className="flex flex-col space-y-2 pt-4">
                <button
                  onClick={applyFilters}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
                >
                  Aplicar Filtros
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
