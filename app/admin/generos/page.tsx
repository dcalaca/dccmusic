'use client'

import { useEffect, useState } from 'react'
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'

interface Genre {
  id: string
  name: string
  slug: string
  color?: string | null
  icon?: string | null
  createdAt: Date
  updatedAt: Date
}

export default function AdminGenresPage() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color: '',
    icon: '',
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGenres()
  }, [])

  const loadGenres = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/generos')
      if (!response.ok) {
        throw new Error('Erro ao carregar gêneros')
      }
      const data = await response.json()
      setGenres(data)
    } catch (error) {
      console.error('Erro ao carregar gêneros:', error)
      alert('Erro ao carregar gêneros')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      setActionLoading('submit')
      
      if (editingGenre) {
        // Atualizar
        const response = await fetch(`/api/admin/generos/${editingGenre.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.details || error.error || 'Erro ao atualizar gênero')
        }

        alert('Gênero atualizado com sucesso!')
      } else {
        // Criar
        const response = await fetch('/api/admin/generos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.details || error.error || 'Erro ao criar gênero')
        }

        alert('Gênero criado com sucesso!')
      }

      // Limpar formulário
      setFormData({ name: '', color: '', icon: '' })
      setShowForm(false)
      setEditingGenre(null)
      loadGenres()
    } catch (error: any) {
      console.error('Erro ao salvar gênero:', error)
      setError(error.message || 'Erro ao salvar gênero')
    } finally {
      setActionLoading(null)
    }
  }

  const handleEdit = (genre: Genre) => {
    // Não permitir editar gêneros extraídos de conteúdo
    if (genre.id.startsWith('content-')) {
      alert('Este gênero foi extraído automaticamente dos conteúdos. Crie um novo gênero na tabela para poder editá-lo.')
      return
    }
    
    setEditingGenre(genre)
    setFormData({
      name: genre.name,
      color: genre.color || '',
      icon: genre.icon || '',
    })
    setShowForm(true)
    setError(null)
  }

  const handleDelete = async (genreId: string, genreName: string) => {
    // Não permitir deletar gêneros extraídos de conteúdo
    if (genreId.startsWith('content-')) {
      alert('Este gênero foi extraído automaticamente dos conteúdos e não pode ser deletado.')
      return
    }
    
    if (!confirm(`Tem certeza que deseja deletar o gênero "${genreName}"?`)) {
      return
    }

    try {
      setActionLoading(genreId)
      const response = await fetch(`/api/admin/generos/${genreId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Erro ao deletar gênero')
      }

      alert('Gênero deletado com sucesso!')
      loadGenres()
    } catch (error: any) {
      console.error('Erro ao deletar gênero:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingGenre(null)
    setFormData({ name: '', color: '', icon: '' })
    setError(null)
  }

  const filteredGenres = genres.filter((genre) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      genre.name.toLowerCase().includes(searchLower) ||
      genre.slug.toLowerCase().includes(searchLower)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <FiRefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando gêneros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Gerenciar Gêneros</span>
            </h1>
            <p className="text-gray-400">Criar e gerenciar gêneros musicais</p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true)
                setEditingGenre(null)
                setFormData({ name: '', color: '', icon: '' })
                setError(null)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              Novo Gênero
            </button>
          )}
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingGenre ? 'Editar Gênero' : 'Novo Gênero'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Gênero *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Rock, Pop, HipHop..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cor (hexadecimal)
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#FF5733"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ícone
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="Nome do ícone"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading === 'submit'}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'submit' ? (
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                  ) : editingGenre ? (
                    'Atualizar'
                  ) : (
                    'Criar'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Busca */}
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar gênero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {/* Lista de Gêneros */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Gênero
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cor
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredGenres.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      {searchTerm ? 'Nenhum gênero encontrado' : 'Nenhum gênero cadastrado'}
                    </td>
                  </tr>
                ) : (
                  filteredGenres.map((genre) => (
                    <tr key={genre.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <FiTag className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{genre.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">/{genre.slug}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {genre.color ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded border border-gray-700"
                              style={{ backgroundColor: genre.color }}
                            />
                            <span className="text-sm text-gray-300">{genre.color}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {genre.id.startsWith('content-') ? (
                          <span className="text-xs text-gray-500 italic">
                            Extraído de conteúdo
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(genre)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                            >
                              <FiEdit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(genre.id, genre.name)}
                              disabled={actionLoading === genre.id}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {actionLoading === genre.id ? (
                                <FiRefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <FiTrash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
