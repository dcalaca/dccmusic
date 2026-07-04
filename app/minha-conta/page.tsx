'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiUser, FiMail, FiCalendar, FiLogOut, FiStar, FiMessageSquare, FiArrowLeft } from 'react-icons/fi'

export default function MinhaContaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRatings: 0,
    totalComments: 0,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('site_user_token')
    const userData = localStorage.getItem('site_user_data')

    if (!token || !userData) {
      router.push('/login?return=/minha-conta')
      return
    }

    try {
      const user = JSON.parse(userData)
      setUser(user)
      loadUserStats(user.id)
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
      localStorage.removeItem('site_user_token')
      localStorage.removeItem('site_user_data')
      router.push('/login?return=/minha-conta')
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async (userId: string) => {
    try {
      const token = localStorage.getItem('site_user_token')
      if (!token) return

      const response = await fetch('/api/site-users/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats({
          totalRatings: data.totalRatings || 0,
          totalComments: data.totalComments || 0,
        })
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const handleLogout = () => {
    if (confirm('Deseja realmente sair?')) {
      localStorage.removeItem('site_user_token')
      localStorage.removeItem('site_user_data')
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Voltar para o site</span>
        </Link>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                <span className="gradient-text">Minha Conta</span>
              </h1>
              <p className="text-gray-400">Gerencie seu perfil e atividades</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <FiLogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>

          {/* Informações do Usuário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center">
                  <FiUser className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <p className="text-gray-400 text-sm">Usuário</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Informações</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FiMail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiCalendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">
                    Membro desde {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-600/20 flex items-center justify-center">
                  <FiStar className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalRatings}</div>
                  <div className="text-sm text-gray-400">Avaliações</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <FiMessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalComments}</div>
                  <div className="text-sm text-gray-400">Comentários</div>
                </div>
              </div>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/musicas"
                className="p-4 bg-gray-900/50 hover:bg-gray-900 border border-gray-700 rounded-lg transition-colors"
              >
                <div className="font-medium mb-1">Explorar Músicas</div>
                <div className="text-sm text-gray-400">Descubra novas músicas</div>
              </Link>
              <Link
                href="/videos"
                className="p-4 bg-gray-900/50 hover:bg-gray-900 border border-gray-700 rounded-lg transition-colors"
              >
                <div className="font-medium mb-1">Explorar Vídeos</div>
                <div className="text-sm text-gray-400">Assista aos vídeos</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
