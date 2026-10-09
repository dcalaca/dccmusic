'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MercadoPagoPaymentOverlay } from '@/components/MercadoPagoCheckout'

export function useFeaturedCheckout(contentType: 'music' | 'video' | 'studio_music', contentId: string, onPaid?: () => void) {
  const { t } = useTranslation()
  const [session, setSession] = useState<{ featuredId: string; amount: number; email: string | null } | null>(null)
  const [loading, setLoading] = useState(false)

  const authenticatedFetch = async (url: string, init?: RequestInit) => {
    const token = localStorage.getItem('composer_token')
    if (!token) throw new Error('Faça login para destacar')
    const response = await fetch(url, { ...init, headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.errorCode === 'audioRequired' ? t('featured.errors.audioRequired') : data.errorCode === 'studioNotEligible' ? t('featured.errors.studioNotEligible') : (data.error || t('featured.errors.processPayment')))
    return data
  }

  const startCheckout = async () => {
    if (loading) return
    setLoading(true)
    try {
      const data = await authenticatedFetch('/api/compositores/featured/intent', {
        method: 'POST', body: JSON.stringify({ contentType, contentId }),
      })
      setSession({ featuredId: data.featuredId, amount: Number(data.amount), email: data.email })
    } catch (error: any) {
      alert(error?.message || 'Não foi possível abrir o pagamento')
    } finally {
      setLoading(false)
    }
  }

  const checkoutUi = session ? (
    <MercadoPagoPaymentOverlay
      notice={t('featured.durationNotice')}
      amount={session.amount}
      email={session.email}
      onSubmitPayment={(formData) => authenticatedFetch('/api/compositores/featured/payment', {
        method: 'POST', body: JSON.stringify({ featuredId: session.featuredId, formData }),
      })}
      onCheckStatus={() => authenticatedFetch(`/api/compositores/featured/check?featuredId=${encodeURIComponent(session.featuredId)}`)}
      onPaid={() => { setSession(null); onPaid?.(); window.location.reload() }}
      onClose={() => setSession(null)}
    />
  ) : null

  return { startCheckout, checkoutUi, loading }
}
