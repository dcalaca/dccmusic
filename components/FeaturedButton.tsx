'use client'

import { useFeaturedCheckout } from '@/hooks/useFeaturedCheckout'

import { useState, useEffect } from 'react'
import { FiStar, FiCheckCircle, FiClock } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { featuredPaymentError, featuredPrice } from '@/lib/featured-payment-ui'

interface FeaturedButtonProps {
  contentType: 'music' | 'video' | 'studio_music'
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
  const { t, i18n } = useTranslation()
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

  const { startCheckout, checkoutUi, loading: checkoutLoading } = useFeaturedCheckout(contentType, contentId)
  const handlePayFeatured = startCheckout

  const formatExpirationDate = (date: Date) => {
    return new Intl.DateTimeFormat(i18n.language, {
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
          <div className="text-yellow-400 font-medium">{t('featured.active')}</div>
          <div className="text-yellow-300/70">
            {t('featured.daysRemaining', { count: daysRemaining })}
          </div>
        </div>
      </div>
    )
  }

  if (featuredStatus?.paymentStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-700 rounded-lg">
        <FiClock className="w-4 h-4 text-blue-400" />
        <div className="text-xs text-blue-300">{t('featured.pending')}</div>
      </div>
    )
  }

  return (
    <>
    <button onClick={handlePayFeatured}
      disabled={checkoutLoading}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 rounded-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      title={t('featured.buttonTitle', { price: featuredPrice(i18n.language) })}
    >
      <FiStar className="w-4 h-4" />
      <span>{checkoutLoading ? t('featured.processing') : t('featured.highlightPrice', { price: featuredPrice(i18n.language) })}</span>
    </button>
    <p className="mt-1 text-xs text-yellow-200">{t('featured.durationNotice')}</p>
    {checkoutUi}
    </>
  )
}
