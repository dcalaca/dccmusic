'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi'
import { trackGoogleAdsPurchaseConversion } from '@/components/GoogleAdsEvents'
import { identifyTikTokCurrentComposer } from '@/components/TikTokEvents'
import { pushGtmEvent } from '@/components/GtmEvents'
import { blogAttributionEventPayload } from '@/lib/blog/attribution'

function PaymentSuccessContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const subscriptionId = searchParams.get('subscription_id')
  const paymentId =
    searchParams.get('payment_id') ||
    searchParams.get('collection_id') ||
    searchParams.get('preference_id') ||
    ''
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const trackPurchase = async (token: string | null) => {
      if (!token || (!paymentId && !subscriptionId)) return
      try {
        const params = new URLSearchParams()
        if (subscriptionId) params.set('subscription_id', subscriptionId)
        if (paymentId && !paymentId.startsWith('pref_')) params.set('payment_id', paymentId)
        const response = await fetch('/api/compositores/analytics/purchase?' + params.toString(), {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        })
        if (!response.ok) return
        const payment = await response.json()
        if (payment.status !== 'paid' || !payment.transactionId) return
        const transactionId = String(payment.transactionId)
        const value = Number(payment.value)
        const currency = String(payment.currency)
        if (!Number.isFinite(value) || value <= 0) return

        const gtag = (window as any).gtag
        if (typeof gtag === 'function') {
          gtag('event', 'compra_plano', {
            event_category: 'purchase',
            event_label: subscriptionId || transactionId,
            value,
            currency,
          })
        }

        trackGoogleAdsPurchaseConversion({ transactionId, value, currency })
        pushGtmEvent('dcc_purchase', {
          product_id: 'composer_plan',
          product_name: 'Plano de compositor',
          product_type: 'subscription',
          transaction_id: transactionId,
          event_id: transactionId,
          value,
          currency,
          ...blogAttributionEventPayload(),
        })

        const oaiq = (window as any).oaiq
        if (typeof oaiq === 'function') {
          oaiq('measure', 'order_created', {
            type: 'contents',
            amount: Math.round(value * 100),
            currency: currency.toUpperCase(),
            contents: [{
              id: 'composer_plan',
              name: 'Plano de compositor',
              content_type: 'product',
              quantity: 1,
            }],
          }, { event_id: 'dcc_order_' + transactionId })
        }
      } catch {
        // Analytics must not fire when the payment cannot be verified.
      }
    }

    const token = localStorage.getItem('composer_token')
    void trackPurchase(token)

    if (!token) {
      router.push('/compositores/login')
      return
    }
    identifyTikTokCurrentComposer()

    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }, [router, subscriptionId, paymentId])

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            {loading ? (
              <div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
                <p className="text-gray-400">{t('payment.status.processing')}</p>
              </div>
            ) : (
              <>
                <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-4">
                  <span className="gradient-text">{t('payment.status.approvedTitle')}</span>
                </h1>
                <p className="text-gray-400 mb-6">
                  {t('payment.status.approvedDescription')}
                </p>
                <Link
                  href="/compositores/admin"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
                >
                  <span>{t('payment.status.goToComposerArea')}</span>
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
