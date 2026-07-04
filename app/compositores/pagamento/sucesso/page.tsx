'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi'
import { trackGoogleAdsPurchaseConversion } from '@/components/GoogleAdsEvents'
import { identifyTikTokCurrentComposer } from '@/components/TikTokEvents'
import { pushGtmEvent } from '@/components/GtmEvents'

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subscriptionId = searchParams.get('subscription_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const gtag = (window as any).gtag
      if (typeof gtag === 'function') {
        gtag('event', 'compra_plano', {
          event_category: 'purchase',
          event_label: subscriptionId || 'composer_plan',
        })
      }
      trackGoogleAdsPurchaseConversion({
        transactionId: subscriptionId || 'composer_plan',
      })
      pushGtmEvent('dcc_purchase', {
        product_id: 'composer_plan',
        product_name: 'Plano de compositor',
        product_type: 'subscription',
        transaction_id: subscriptionId || 'composer_plan',
        event_id: subscriptionId || 'composer_plan',
        currency: 'BRL',
      })
    }

    // Verificar se compositor está logado
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }
    identifyTikTokCurrentComposer()

    // Aguardar um pouco para garantir que o webhook processou
    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }, [router])

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
