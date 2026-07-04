'use client'

import { useState, useEffect } from 'react'
import { FiStar, FiCheckCircle, FiClock } from 'react-icons/fi'

interface FeaturedButtonProps {
  contentType: 'music' | 'video'
  contentId: string
  composerId: string
  currentFeatured?: boolean
}

export default function FeaturedButton({
  contentType,
  contentId,
  composerId,
  currentFeatured,
}: FeaturedButtonProps) {
  const [loading, setLoading] = useState(false)
  const [featuredStatus, setFeaturedStatus] = useState<{
    isActive: boolean
    expiresAt?: Date
    paymentStatus?: 'pending' | 'approved' | 'rejected'
  } | null>(null)

  useEffect(() => {
    checkFeaturedStatus()
  }, [contentType, contentId])

  const checkFeaturedStatus = async () => {
    try {
      const token = localStorage.getItem('composer_token')
      if (!token) return

      const response = await fetch(
        `/api/compositores/featured/status?contentType=${contentType}&contentId=${contentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFeaturedStatus({
          isActive: data.isActive || false,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          paymentStatus: data.paymentStatus,
        })
      }
    } catch (error) {
      console.error('Erro ao verificar status do destaque:', error)
    }
  }

  const handlePayFeatured = async () => {
    if (loading) return

    setLoading(true)
    try {
      const token = localStorage.getItem('composer_token')
      if (!token) {
        alert('Faça login para continuar')
        return
      }

      const response = await fetch('/api/compositores/featured/preferencia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType,
          contentId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar pagamento')
      }

      // Redirecionar para Mercado Pago
      const initPoint = data.initPoint || data.sandboxInitPoint
      if (initPoint) {
        window.location.href = initPoint
      }
    } catch (error: any) {
      console.error('Erro ao pagar destaque:', error)
      alert(error.message || 'Erro ao processar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const formatExpirationDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  }

  const getDaysRemaining = (expiresAt: Date) => {
    const now = new Date()
    const diff = expiresAt.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 0
  }

  if (featuredStatus?.isActive && featuredStatus.expiresAt) {
    const daysRemaining = getDaysRemaining(featuredStatus.expiresAt)
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700 rounded-lg">
        <FiCheckCircle className="w-4 h-4 text-yellow-400" />
        <div className="text-xs">
          <div className="text-yellow-400 font-medium">Em Destaque</div>
          <div className="text-yellow-300/70">
            {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    )
  }

  if (featuredStatus?.paymentStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-700 rounded-lg">
        <FiClock className="w-4 h-4 text-blue-400" />
        <div className="text-xs text-blue-300">Pagamento pendente</div>
      </div>
    )
  }

  return (
    <button
      onClick={handlePayFeatured}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 rounded-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      title="Pagar R$ 9,90 para destacar por 10 dias"
    >
      <FiStar className="w-4 h-4" />
      <span>{loading ? 'Processando...' : 'Destacar (R$ 9,90)'}</span>
    </button>
  )
}
