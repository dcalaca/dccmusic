'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiStar, FiX, FiCheckCircle } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { featuredPaymentError, featuredPrice } from '@/lib/featured-payment-ui'

interface FeaturedOfferModalProps {
  contentType: 'music' | 'video'
  contentId: string
  contentTitle: string
  composerId: string
  onClose: () => void
}

export default function FeaturedOfferModal({
  contentType,
  contentId,
  contentTitle,
  composerId,
  onClose,
}: FeaturedOfferModalProps) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handlePayFeatured = async () => {
    let paymentError = t('featured.errors.processPayment')
    setLoading(true)
    try {
      const token = localStorage.getItem('composer_token')
      if (!token) {
        alert(t('featured.loginRequired'))
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

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        paymentError = featuredPaymentError(t, data, response.status)
        throw new Error(paymentError)
      }

      // Redirecionar para Mercado Pago
      const initPoint = data.initPoint || data.sandboxInitPoint
      if (initPoint) {
        window.location.href = initPoint
      } else {
        paymentError = t('featured.errors.missingCheckout')
        throw new Error(paymentError)
      }
    } catch (error: any) {
      console.error('Erro ao pagar destaque:', error)
      alert(paymentError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          aria-label={t('featured.close')}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-900/30 rounded-full mb-4">
            <FiStar className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            <span className="gradient-text">{t('featured.modal.savedTitle')}</span>
          </h2>
          <p className="text-gray-300 mb-4">
            <strong className="text-white">{contentTitle}</strong> {t('featured.modal.savedSuccess')}
          </p>
        </div>

        <div className="bg-primary-900/20 border border-primary-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-primary-300 mb-2 flex items-center gap-2">
            <FiCheckCircle className="w-5 h-5" />
            {t('featured.modal.featureTitle')}
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            {contentType === 'music' ? t('featured.modal.descriptionMusic') : t('featured.modal.descriptionVideo')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-yellow-400">{featuredPrice(i18n.language)}</span>
            <span className="text-gray-400 text-sm">{t('featured.modal.pricePeriod')}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-medium"
          >
            {t('featured.modal.notNow')}
          </button>
          <button
            onClick={handlePayFeatured}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{t('featured.processing')}</span>
              </>
            ) : (
              <>
                <FiStar className="w-4 h-4" />
                <span>{t('featured.modal.highlightNow')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
