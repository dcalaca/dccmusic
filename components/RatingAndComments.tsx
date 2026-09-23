'use client'

import { useState, useEffect } from 'react'
import RatingStars from './RatingStars'
import CommentsSection from './CommentsSection'
import Toast from './Toast'

interface RatingAndCommentsProps {
  contentType: 'music' | 'video' | 'studio_music'
  contentId: string
}

export default function RatingAndComments({
  contentType,
  contentId,
}: RatingAndCommentsProps) {
  const [ratingStats, setRatingStats] = useState({
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    userRating: undefined as number | undefined,
  })
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'warning' | 'error' } | null>(null)
  const [mounted, setMounted] = useState(false)

  const getInteractionAuthToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('composer_token') || localStorage.getItem('site_user_token')
  }

  useEffect(() => {
    // Marcar como montado apenas no cliente para evitar hydration mismatch
    setMounted(true)
  }, [])

  useEffect(() => {
    // Só executar no cliente após montagem
    if (!mounted) return
    
    checkAuth()
    loadRatingStats()
    
    // Escutar mudanças no localStorage (logout/login)
    const handleStorageChange = () => {
      checkAuth()
      loadRatingStats()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [contentType, contentId, mounted])

  const checkAuth = () => {
    // Verificar se está no cliente antes de acessar localStorage
    if (typeof window === 'undefined') return
    
    const composerToken = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')
    const token = localStorage.getItem('site_user_token')
    const userData = localStorage.getItem('site_user_data')

    if (composerToken && composerData) {
      try {
        const composer = JSON.parse(composerData)
        setIsAuthenticated(true)
        setCurrentUser({
          ...composer,
          authType: 'composer',
        })
        return
      } catch (error) {
        localStorage.removeItem('composer_token')
        localStorage.removeItem('composer_data')
      }
    }

    if (token && userData) {
      try {
        const user = JSON.parse(userData)
        setIsAuthenticated(true)
        setCurrentUser({
          ...user,
          authType: 'site_user',
        })
      } catch (error) {
        localStorage.removeItem('site_user_token')
        localStorage.removeItem('site_user_data')
      }
    } else {
      setIsAuthenticated(false)
      setCurrentUser(null)
    }
  }

  const loadRatingStats = async () => {
    // Verificar se está no cliente antes de acessar localStorage
    if (typeof window === 'undefined') return
    
    try {
      setLoading(true)
      const token = getInteractionAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(
        `/api/ratings?contentType=${contentType}&contentId=${contentId}`,
        { headers }
      )

      if (response.ok) {
        const data = await response.json()
        setRatingStats(data)
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRate = async (rating: number) => {
    // Verificar se está no cliente
    if (typeof window === 'undefined') return
    
    // Verificar se já tem avaliação e está clicando na mesma estrela
    if (ratingStats.userRating && ratingStats.userRating === rating) {
      setToast({
        message: `Você já classificou essa ${contentType === 'music' ? 'música' : 'vídeo'}`,
        type: 'info',
      })
      return
    }

    try {
      const token = getInteractionAuthToken()
      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType,
          contentId,
          rating,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao avaliar')
      }

      const data = await response.json()
      setRatingStats(data.stats)
      
      // Mostrar mensagem de sucesso se atualizou a avaliação
      if (ratingStats.userRating) {
        setToast({
          message: 'Avaliação atualizada com sucesso!',
          type: 'success',
        })
      }
    } catch (error: any) {
      console.error('Erro ao avaliar:', error)
      setToast({
        message: error.message || 'Erro ao avaliar',
        type: 'error',
      })
      throw error
    }
  }

  const handleLoginRequired = () => {
    // Redirecionar para página de login ou abrir modal
    if (typeof window !== 'undefined') {
      const returnUrl = `${window.location.pathname}${window.location.search}`
      window.location.href = `/compositores/login?redirect=${encodeURIComponent(returnUrl)}`
    }
  }

  // Não renderizar conteúdo que depende de localStorage até estar montado no cliente
  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-2xl font-bold mb-4">
            <span className="gradient-text">Avaliação</span>
          </h2>
          <div className="text-gray-400">Carregando...</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-2xl font-bold mb-4">
            <span className="gradient-text">Comentários</span>
          </h2>
          <div className="text-gray-400">Carregando...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="space-y-8">
        {/* Seção de Avaliação */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-2xl font-bold mb-4">
            <span className="gradient-text">Avaliação</span>
          </h2>
          {loading ? (
            <div className="text-gray-400">Carregando...</div>
          ) : (
            <RatingStars
              averageRating={ratingStats.averageRating}
              totalRatings={ratingStats.totalRatings}
              userRating={ratingStats.userRating}
              onRate={handleRate}
              isAuthenticated={isAuthenticated}
              onLoginRequired={handleLoginRequired}
              size="lg"
            />
          )}
        </div>

        {/* Seção de Comentários */}
        <CommentsSection
          contentType={contentType}
          contentId={contentId}
          isAuthenticated={isAuthenticated}
          currentUserId={currentUser?.id}
          onLoginRequired={handleLoginRequired}
        />
      </div>
    </>
  )
}
