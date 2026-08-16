'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi'
import { trackGoogleAdsPurchaseConversion } from '@/components/GoogleAdsEvents'
import { identifyTikTokCurrentComposer } from '@/components/TikTokEvents'
import { pushGtmEvent } from '@/components/GtmEvents'
import { blogAttributionEventPayload } from '@/lib/blog/attribution'

function PaymentSuccessContent() {
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
    const transactionId = paymentId || subscriptionId || 'composer_plan'

    const trackPurchase = async (token: string | null) => {
      let value: number | undefined
      let currency = 'BRL'

      if (token) {
        try {
          const response = await fetch('/api/compositores/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
            const data = await response.json()
            const price = Number(data?.plan?.price ?? data?.subscription?.plan?.price)
            if (Number.isFinite(price) && price > 0) value = price
            if (data?.subscription?.currency) currency = String(data.subscription.currency)
          }
        } catch {
          // segue sem valor se a API falhar
        }
      }

      const gtag = (window as any).gtag
      if (typeof gtag === 'function') {
        gtag('event', 'compra_plano', {
          event_category: 'purchase',
          event_label: subscriptionId || 'composer_plan',
          ...(typeof value === 'number' ? { value, currency } : {}),
        })
      }

      trackGoogleAdsPurchaseConversion({
        transactionId,
        value,
        currency,
      })

      pushGtmEvent('dcc_purchase', {
        product_id: 'composer_plan',
        product_name: 'Plano de compositor',
        product_type: 'subscription',
        transaction_id: transactionId,
        event_id: transactionId,
        currency,
        ...(typeof value === 'number' ? { value } : {}),
        ...blogAttributionEventPayload(),
      })
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
                <p className="text-gray-400">Processando...</p>
              </div>
            ) : (
              <>
                <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h1 className="text-3xl font-bold mb-4">
                  <span className="gradient-text">Pagamento Aprovado!</span>
                </h1>
                <p className="text-gray-400 mb-6">
                  Sua assinatura foi ativada com sucesso. Agora você pode cadastrar suas músicas e vídeos!
                </p>
                <Link
                  href="/compositores/admin"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
                >
                  <span>Ir para Área do Compositor</span>
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
