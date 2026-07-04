'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FiCheckCircle, FiArrowRight, FiLoader } from 'react-icons/fi'
import { trackGoogleAdsPurchaseConversion } from '@/components/GoogleAdsEvents'
import { identifyTikTokCurrentComposer, trackTikTokEvent } from '@/components/TikTokEvents'

function StudioTopupSuccessContent() {
  const searchParams = useSearchParams()
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'paid' | 'pending' | 'error'>('syncing')
  const [message, setMessage] = useState('Conferindo confirmação do Mercado Pago...')

  const trackStudioTopupPurchase = async (data: any) => {
    if (typeof window === 'undefined') return

    const topupId = data?.topupId || searchParams.get('topup_id') || 'studio_topup'
    const paymentId = data?.paymentId || searchParams.get('payment_id') || searchParams.get('collection_id') || ''
    const eventKey = `meta_purchase_studio_topup:${topupId}:${paymentId}`
    if (sessionStorage.getItem(eventKey)) return
    sessionStorage.setItem(eventKey, '1')

    const value = Number(data?.amount) || 0
    const currency = data?.currency || 'BRL'
    const eventId = paymentId || topupId
    if (value <= 0) return

    const fbq = (window as any).fbq
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', {
        content_name: 'Recarga Studio IA',
        content_type: 'product',
        contents: [{
          id: 'studio_topup',
          quantity: Number(data?.musicQuantity) || 1,
        }],
        currency,
        value,
      }, {
        eventID: eventId,
      })
    }

    await identifyTikTokCurrentComposer()
    trackTikTokEvent('CompletePayment', {
      content_id: 'studio_topup',
      content_name: 'Recarga Studio IA',
      content_type: 'product',
      currency,
      event_id: eventId,
      quantity: Number(data?.musicQuantity) || 1,
      value,
    })

    const gtag = (window as any).gtag
    if (typeof gtag === 'function') {
      gtag('event', 'purchase_studio_topup', {
        event_category: 'purchase',
        event_label: topupId,
        transaction_id: eventId,
        currency,
        value,
      })
    }

    trackGoogleAdsPurchaseConversion({
      transactionId: eventId,
      value,
      currency,
    })
  }

  useEffect(() => {
    const syncTopup = async () => {
      const token = localStorage.getItem('composer_token')
      const topupId = searchParams.get('topup_id')
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')

      if (!token || !topupId) {
        setSyncStatus('pending')
        setMessage('Assim que o Mercado Pago confirmar o pagamento, os créditos aparecem no seu saldo do Studio IA.')
        return
      }

      try {
        const response = await fetch('/api/compositores/studio/topup/sync', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topupId, paymentId }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao confirmar recarga')

        if (data.status === 'paid') {
          setSyncStatus('paid')
          setMessage('Pagamento confirmado. Seus créditos já foram liberados no Studio IA.')
          trackStudioTopupPurchase(data)
          return
        }

        setSyncStatus('pending')
        setMessage('Pagamento recebido. A recarga será liberada automaticamente assim que a confirmação final chegar.')
      } catch (error: any) {
        setSyncStatus('error')
        setMessage(error.message || 'Não foi possível confirmar automaticamente agora. A confirmação por webhook ainda pode liberar seus créditos.')
      }
    }

    syncTopup()
  }, [searchParams])

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md rounded-3xl border border-green-800 bg-green-950/30 p-8 text-center">
          {syncStatus === 'syncing' ? (
            <FiLoader className="mx-auto mb-4 h-16 w-16 animate-spin text-green-300" />
          ) : (
            <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-green-300" />
          )}
          <h1 className="mb-3 text-3xl font-black">Recarga aprovada</h1>
          <p className="mb-6 text-gray-300">
            {message}
          </p>
          <Link
            href="/compositores/admin/studio-ia"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold"
          >
            Voltar ao Studio IA <FiArrowRight />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function StudioTopupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <FiLoader className="h-12 w-12 animate-spin text-green-300" />
      </div>
    }>
      <StudioTopupSuccessContent />
    </Suspense>
  )
}
