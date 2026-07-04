'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiCheck, FiCreditCard, FiLoader, FiZap } from 'react-icons/fi'
import { trackPartnerEvent } from '@/components/PartnerAttribution'
import { trackTikTokEvent } from '@/components/TikTokEvents'

type TopupTier = {
  maxMusicQuantity: number | null
  unitPrice: number
  label: string
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function StudioTopupPage() {
  const router = useRouter()
  const [tiers, setTiers] = useState<TopupTier[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')
  const [musicQuantity, setMusicQuantity] = useState(1)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/recarga')
      return
    }

    try {
      setLoading(true)
      setError('')

      const [packagesResponse, statusResponse] = await Promise.all([
        fetch('/api/compositores/studio/topup/packages', { cache: 'no-store' }),
        fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ])

      if (statusResponse.status === 401) {
        localStorage.removeItem('composer_token')
        router.push('/compositores/login?redirect=/compositores/admin/studio-ia/recarga')
        return
      }

      const packagesData = await packagesResponse.json()
      const statusData = await statusResponse.json()

      if (!packagesResponse.ok) throw new Error(packagesData.error || 'Erro ao carregar pacotes')
      if (!statusResponse.ok) throw new Error(statusData.error || 'Erro ao carregar saldo')

      setTiers(packagesData.tiers || [])
      setStatus(statusData)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar recarga avulsa')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentTier = () => {
    return tiers.find((tier) => tier.maxMusicQuantity === null || musicQuantity <= tier.maxMusicQuantity) || {
      maxMusicQuantity: null,
      unitPrice: 2.99,
      label: 'Música avulsa',
    }
  }

  const currentTier = getCurrentTier()
  const normalizedMusicQuantity = Math.max(1, Math.floor(Number(musicQuantity) || 1))
  const totalPrice = Number((normalizedMusicQuantity * currentTier.unitPrice).toFixed(2))
  const totalCredits = normalizedMusicQuantity * 10
  const quickQuantities = [1, 8, 13, 30, 50, 100]

  const trackCheckoutStart = (eventId: string) => {
    trackPartnerEvent('checkout_started', {
      product: 'studio_topup',
      musicQuantity: normalizedMusicQuantity,
      amount: totalPrice,
    })
    trackTikTokEvent('InitiateCheckout', {
      content_id: 'studio_topup',
      content_name: 'Recarga Studio IA',
      content_category: 'Studio IA',
      currency: 'BRL',
      event_id: eventId,
      price: currentTier.unitPrice,
      quantity: normalizedMusicQuantity,
      value: totalPrice,
    })
  }

  const startRedirectCheckout = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/recarga')
      return
    }

    try {
      setCheckoutLoading(true)
      setError('')
      trackCheckoutStart(`initiate_checkout:studio_topup:${Date.now()}`)

      const response = await fetch('/api/compositores/studio/topup/preferencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ musicQuantity: normalizedMusicQuantity }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Erro ao iniciar pagamento')

      const metaEventId = data.metaInitiateCheckoutEventId || `initiate_checkout:studio_topup:${data.preferenceId || Date.now()}`
      const fbq = (window as any).fbq
      if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', {
          content_id: 'studio_topup',
          content_name: 'Recarga Studio IA',
          content_type: 'product',
          contents: [{
            id: 'studio_topup',
            quantity: normalizedMusicQuantity,
          }],
          currency: 'BRL',
          value: totalPrice,
        }, {
          eventID: metaEventId,
        })
      }

      const checkoutUrl = data.initPoint || data.sandboxInitPoint
      if (!checkoutUrl) throw new Error('Mercado Pago não retornou o link de pagamento.')

      window.location.href = checkoutUrl
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar pagamento')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const updateMusicQuantity = (quantity: number) => {
    setMusicQuantity(quantity)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-12 w-12 animate-spin text-primary-300" />
      </div>
    )
  }

  const credits = status?.credits || { used: 0, limit: 0, remaining: 0 }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/compositores/admin/studio-ia" className="mb-8 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar ao Studio IA
          </Link>

          <section className="mb-8 rounded-3xl border border-purple-700/60 bg-gradient-to-br from-black via-gray-950 to-purple-950/70 p-8 sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-sm text-purple-100">
                  <FiZap /> Recarga avulsa
                </span>
                <h1 className="text-4xl font-black sm:text-5xl">
                  Compre créditos extras para continuar criando
                </h1>
                <p className="mt-4 max-w-2xl text-gray-300">
                  Digite quantas músicas quer comprar. O valor muda automaticamente conforme a faixa de preço.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/50 p-5">
                <p className="text-sm text-gray-400">Saldo atual</p>
                <p className="text-3xl font-black text-primary-300">{credits.remaining} créditos</p>
                <p className="mt-1 text-xs text-gray-500">
                  Usados {credits.used} de {credits.limit}. Cada música usa 10 créditos.
                </p>
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6 sm:p-8">
              <label className="mb-3 block text-sm font-bold text-gray-200">
                Quantas músicas você quer comprar?
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={musicQuantity}
                onChange={(event) => updateMusicQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                className="w-full rounded-2xl border border-purple-700/70 bg-black px-5 py-4 text-3xl font-black text-white outline-none focus:border-purple-300"
              />

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {quickQuantities.map((quantity) => (
                  <button
                    key={quantity}
                    type="button"
                    onClick={() => updateMusicQuantity(quantity)}
                    className="rounded-xl border border-gray-800 bg-black/40 px-4 py-3 text-sm font-bold text-gray-200 hover:border-purple-500"
                  >
                    {quantity} músicas
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  {totalCredits} créditos extras
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  Liberação automática após pagamento aprovado
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  Pagamento via Mercado Pago
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border border-purple-500/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black p-6 sm:p-8">
              <p className="text-sm text-purple-200">{currentTier.label}</p>
              <p className="mt-3 text-5xl font-black text-white">{formatMoney(totalPrice)}</p>
              <p className="mt-2 text-lg text-primary-300">
                {formatMoney(currentTier.unitPrice)} por música
              </p>
              <p className="mt-4 text-sm text-gray-400">
                {normalizedMusicQuantity} músicas x {formatMoney(currentTier.unitPrice)}
              </p>

              <button
                type="button"
                onClick={startRedirectCheckout}
                disabled={checkoutLoading}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-bold text-white hover:from-primary-500 hover:to-purple-500 disabled:opacity-60"
              >
                {checkoutLoading ? <FiLoader className="animate-spin" /> : <FiCreditCard />}
                Comprar Recarga Avulsa
              </button>

              <div className="mt-6 rounded-2xl border border-gray-800 bg-black/40 p-4 text-xs text-gray-400">
                {tiers.map((tier) => (
                  <p key={tier.label}>{tier.label}: {formatMoney(tier.unitPrice)} por música</p>
                ))}
              </div>
            </aside>
          </div>

        </div>
      </div>
    </div>
  )
}
