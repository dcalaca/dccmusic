'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiArrowRight, FiCheckCircle, FiClock, FiLoader } from 'react-icons/fi'
import { identifyTikTokCurrentComposer, trackTikTokEvent } from '@/components/TikTokEvents'

function StudioTopupPendingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [syncStatus, setSyncStatus] = useState<'checking' | 'paid' | 'pending' | 'error'>('checking')
  const [message, setMessage] = useState('Conferindo se o pagamento já foi confirmado...')

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
  }

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const syncTopup = async () => {
      const token = localStorage.getItem('composer_token')
      const topupId = searchParams.get('topup_id')
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')

      if (!token || !topupId) {
        if (cancelled) return
        setSyncStatus('pending')
        setMessage('A recarga será liberada automaticamente quando o Mercado Pago confirmar o pagamento.')
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
        if (!response.ok) throw new Error(data.error || 'Erro ao conferir recarga')

        if (cancelled) return

        if (data.status === 'paid') {
          setSyncStatus('paid')
          setMessage('Pagamento confirmado. Seus créditos já foram liberados no Studio IA.')
          trackStudioTopupPurchase(data)
          window.dispatchEvent(new Event('studioBalanceChange'))
          const successParams = new URLSearchParams()
          successParams.set('topup_id', topupId)
          if (paymentId) successParams.set('payment_id', paymentId)
          router.replace(`/compositores/admin/studio-ia/recarga/sucesso?${successParams.toString()}`)
          return
        }

        setSyncStatus('pending')
        setMessage('Pagamento recebido. Estamos aguardando a confirmação final do Mercado Pago...')
        retryTimer = setTimeout(syncTopup, 4000)
      } catch (error: any) {
        if (cancelled) return
        setSyncStatus('error')
        setMessage(error.message || 'Não foi possível conferir automaticamente agora. A confirmação por webhook ainda pode liberar seus créditos.')
        retryTimer = setTimeout(syncTopup, 6000)
      }
    }

    syncTopup()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [router, searchParams])

  const isPaid = syncStatus === 'paid'
  const isChecking = syncStatus === 'checking'

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className={`mx-auto max-w-md rounded-3xl border p-8 text-center ${
          isPaid
            ? 'border-green-800 bg-green-950/30'
            : 'border-yellow-800 bg-yellow-950/20'
        }`}>
          {isChecking ? (
            <FiLoader className="mx-auto mb-4 h-16 w-16 animate-spin text-yellow-300" />
          ) : isPaid ? (
            <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-green-300" />
          ) : (
            <FiClock className="mx-auto mb-4 h-16 w-16 text-yellow-300" />
          )}
          <h1 className="mb-3 text-3xl font-black">
            {isPaid ? 'Recarga liberada' : 'Pagamento pendente'}
          </h1>
          <p className="mb-6 text-gray-300">
            {message}
          </p>
          <Link
            href="/compositores/admin/studio-ia"
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${
              isPaid
                ? 'bg-gradient-to-r from-primary-600 to-purple-600'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Voltar ao Studio IA <FiArrowRight />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function StudioTopupPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <FiLoader className="h-12 w-12 animate-spin text-yellow-300" />
      </div>
    }>
      <StudioTopupPendingContent />
    </Suspense>
  )
}
