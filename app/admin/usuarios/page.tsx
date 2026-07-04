'use client'

import { useEffect, useState } from 'react'
import { FiUsers, FiMail, FiCalendar, FiCheckCircle, FiXCircle, FiSearch, FiStar, FiMessageCircle, FiKey } from 'react-icons/fi'
import { formatDate } from '@/lib/utils'

interface SiteUser {
  id: string
  name: string
  email: string
  firstName: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  ratingsCount: number
  commentsCount: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<SiteUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users/list')
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      alert('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar usuário')
      }

      await loadUsers()
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar usuário')
      }

      await loadUsers()
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Deseja resetar a senha do usuário "${userName}" para "123"?\n\nO usuário precisará criar uma nova senha ao fazer login.`)) {
      return
    }

    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao resetar senha')
      }

      alert('Senha resetada com sucesso! A nova senha temporária é "123".')
      await loadUsers()
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Filtrar usuários
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Estatísticas
  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    totalRatings: users.reduce((sum, u) => sum + u.ratingsCount, 0),
    totalComments: users.reduce((sum, u) => sum + u.commentsCount, 0),
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-gray-400">Carregando usuários...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
            <span className="gradient-text">Gerenciar Usuários</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400">Usuários que avaliam e comentam músicas e vídeos</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Total</div>
            <div className="text-xl sm:text-2xl font-bold text-primary-400">{stats.total}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Ativos</div>
            <div className="text-xl sm:text-2xl font-bold text-green-400">{stats.active}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Inativos</div>
            <div className="text-xl sm:text-2xl font-bold text-red-400">{stats.inactive}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FiStar className="w-3 h-3" />
              Avaliações
            </div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.totalRatings}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FiMessageCircle className="w-3 h-3" />
              Comentários
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-400">{stats.totalComments}</div>
          </div>
        </div>

        {/* Busca */}
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {/* Lista de Usuários */}
        {filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado ainda.'}
            </p>
          </div>
        ) : (
          <>
            {/* Versão Desktop: Tabela */}
            <div className="hidden lg:block bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Avaliações
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Comentários
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Cadastrado em
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 lg:px-6 py-4">
                          <div className="font-medium text-sm lg:text-base">{user.name}</div>
                          {user.firstName && user.firstName !== user.name && (
                            <div className="text-xs text-gray-500">({user.firstName})</div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <FiMail className="w-4 h-4 text-gray-400" />
                            <span className="text-xs lg:text-sm text-gray-300">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <FiStar className="w-4 h-4 text-yellow-400" />
                            <span className="font-medium">{user.ratingsCount}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <FiMessageCircle className="w-4 h-4 text-blue-400" />
                            <span className="font-medium">{user.commentsCount}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-gray-400 text-xs lg:text-sm">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(user.id, user.isActive)}
                            disabled={actionLoading === user.id}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              user.isActive
                                ? 'bg-green-900/50 text-green-300 hover:bg-green-900/70'
                                : 'bg-red-900/50 text-red-300 hover:bg-red-900/70'
                            } ${actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResetPassword(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className={`px-3 py-1 bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900/70 rounded text-xs transition-colors flex items-center gap-1 ${
                                actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title="Resetar senha para '123'"
                            >
                              <FiKey className="w-3 h-3" />
                              Resetar Senha
                            </button>
                            <button
                              onClick={() => handleDelete(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className={`px-3 py-1 bg-red-900/50 text-red-300 hover:bg-red-900/70 rounded text-xs transition-colors ${
                                actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              Deletar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Versão Mobile/Tablet: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-base mb-1 truncate">{user.name}</h3>
                      {user.firstName && user.firstName !== user.name && (
                        <p className="text-sm text-gray-400 mb-2">({user.firstName})</p>
                      )}
                      <div className="flex items-center space-x-2 text-sm text-gray-400 mb-2">
                        <FiMail className="w-4 h-4" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={actionLoading === user.id}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ml-2 ${
                        user.isActive
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      } ${actionLoading === user.id ? 'opacity-50' : ''}`}
                    >
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <FiStar className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-300">{user.ratingsCount} avaliações</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <FiMessageCircle className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">{user.commentsCount} comentários</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <div className="text-xs text-gray-500">
                      Cadastrado: {formatDate(user.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetPassword(user.id, user.name)}
                        disabled={actionLoading === user.id}
                        className={`px-3 py-1 bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900/70 rounded text-xs transition-colors flex items-center gap-1 ${
                          actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Resetar senha para '123'"
                      >
                        <FiKey className="w-3 h-3" />
                        Resetar
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={actionLoading === user.id}
                        className={`px-3 py-1 bg-red-900/50 text-red-300 hover:bg-red-900/70 rounded text-xs transition-colors ${
                          actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
