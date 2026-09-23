'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useLocalization } from '@/components/LocalizationProvider'
import { FiArrowLeft, FiCheck, FiCreditCard, FiLoader, FiZap } from 'react-icons/fi'
import { trackPartnerEvent } from '@/components/PartnerAttribution'
import { trackTikTokEvent } from '@/components/TikTokEvents'
import { MercadoPagoPaymentOverlay } from '@/components/MercadoPagoCheckout'
import { isMercadoPagoInSiteCheckoutEnabled } from '@/lib/mp-in-site-checkout'
import { StripePaymentOverlay } from '@/components/StripeCheckout'
import type { DccCountry } from '@/lib/localization'

type TopupTier = {
  maxMusicQuantity: number | null
  unitPrice: number
  label: string
}

function LocalizedMoney({ value, country }: { value: number; country: DccCountry }) {
  const configs: Record<string, { locale: string; currency: string; maximumFractionDigits: number }> = {
    BR: { locale: 'pt-BR', currency: 'BRL', maximumFractionDigits: 2 },
    PY: { locale: 'es-PY', currency: 'PYG', maximumFractionDigits: 0 },
    CO: { locale: 'es-CO', currency: 'COP', maximumFractionDigits: 0 },
    PT: { locale: 'pt-PT', currency: 'EUR', maximumFractionDigits: 2 },
    MX: { locale: 'es-MX', currency: 'MXN', maximumFractionDigits: 2 },
    US: { locale: 'en-US', currency: 'USD', maximumFractionDigits: 2 },
    GB: { locale: 'en-GB', currency: 'GBP', maximumFractionDigits: 2 },
  }
  const config = configs[String(country)] || configs.BR

  return <>{new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: config.maximumFractionDigits,
  }).format(value)}</>
}

export default function StudioTopupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { country, paymentProvider } = useLocalization()
  const [tiers, setTiers] = useState<TopupTier[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')
  const [musicQuantity, setMusicQuantity] = useState(1)
  const [musicQuantityDraft, setMusicQuantityDraft] = useState('1')
  const [inSiteCheckout, setInSiteCheckout] = useState<{
    topupId: string
    amount: number
    email?: string | null
    provider: 'stripe' | 'mercadopago'
    stripeClientSecret?: string
    stripePublishableKey?: string
    stripeSessionId?: string
  } | null>(null)
  const paidRedirectRef = useRef(false)
  const checkoutCurrency = country === 'PT' ? 'EUR'
    : country === 'PY' ? 'PYG'
      : country === 'CO' ? 'COP'
        : country === 'MX' ? 'MXN'
          : String(country) === 'US' ? 'USD' : String(country) === 'GB' ? 'GBP'
            : 'BRL'

  const openStripeFallback = async (topupId: string, amount: number, email?: string | null) => {
    const token = localStorage.getItem('composer_token')
    if (!token) throw new Error(t('auth.errors.sessionExpired'))
    const response = await fetch('/api/compositores/studio/topup/stripe/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topupId }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(t('payment.checkout.errors.openStripe'))
    setInSiteCheckout({
      topupId,
      amount,
      email,
      provider: 'stripe',
      stripeClientSecret: result.clientSecret,
      stripePublishableKey: result.publishableKey,
      stripeSessionId: result.sessionId,
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!inSiteCheckout) {
      paidRedirectRef.current = false
      return
    }

    let cancelled = false
    let inFlight = false

    const goToSuccess = (data?: { topupId?: string; paymentId?: string | null }) => {
      if (paidRedirectRef.current) return
      paidRedirectRef.current = true
      const params = new URLSearchParams()
      params.set('topup_id', data?.topupId || inSiteCheckout.topupId)
      if (data?.paymentId) params.set('payment_id', String(data.paymentId))
      router.push(`/compositores/admin/studio-ia/recarga/sucesso?${params.toString()}`)
    }

    const checkWebhookStatus = async () => {
      if (cancelled || inFlight || paidRedirectRef.current) return
      const token = localStorage.getItem('composer_token')
      if (!token) return

      inFlight = true
      try {
        const response = await fetch(
          `/api/compositores/studio/topup/status?topupId=${encodeURIComponent(inSiteCheckout.topupId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        )
        const data = await response.json()
        if (cancelled || !response.ok) return
        if (data.status === 'paid' || data.status === 'approved') {
          goToSuccess(data)
        }
      } catch {
        // O webhook ainda pode chegar; tenta de novo.
      } finally {
        inFlight = false
      }
    }

    const onResume = () => {
      if (document.visibilityState === 'hidden') return
      void checkWebhookStatus()
    }

    void checkWebhookStatus()
    const interval = window.setInterval(checkWebhookStatus, 2000)
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [inSiteCheckout, router])

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

      if (!packagesResponse.ok) throw new Error(t('payment.topup.errors.loadPackages'))
      if (!statusResponse.ok) throw new Error(t('payment.topup.errors.loadBalance'))

      setTiers(packagesData.tiers || [])
      setStatus(statusData)
    } catch (err: any) {
      setError(err.message || t('payment.topup.errors.load'))
    } finally {
      setLoading(false)
    }
  }

  const normalizedMusicQuantity = Math.max(1, Math.floor(Number(musicQuantity) || 1))
  const getCurrentTier = () => {
    const fallbackUnitPrice = String(country) === 'US' || String(country) === 'GB' ? 0
      : country === 'PT' ? 1.99
      : country === 'PY' ? 5600
        : country === 'CO' ? 3200
          : country === 'MX' ? 17.68
            : 2.99

    return tiers.find((tier) => tier.maxMusicQuantity === null || normalizedMusicQuantity <= tier.maxMusicQuantity) || {
      maxMusicQuantity: null,
      unitPrice: fallbackUnitPrice,
      label: t('payment.topup.page.singleTier'),
    }
  }

  const currentTier = getCurrentTier()
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
      currency: checkoutCurrency,
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

      if (paymentProvider === 'stripe' || isMercadoPagoInSiteCheckoutEnabled()) {
        const intentResponse = await fetch('/api/compositores/studio/topup/intent', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            musicQuantity: normalizedMusicQuantity,
            provider: paymentProvider,
            country,
          }),
        })
        const intent = await intentResponse.json()
        if (!intentResponse.ok) throw new Error(t('payment.checkout.errors.start'))

        const metaEventId = intent.metaInitiateCheckoutEventId || `initiate_checkout:studio_topup:${intent.topupId || Date.now()}`
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
            currency: intent.currency || checkoutCurrency,
            value: Number(intent.amount) || totalPrice,
          }, {
            eventID: metaEventId,
          })
        }

        if (intent.provider === 'stripe') {
          await openStripeFallback(intent.topupId, Number(intent.amount) || totalPrice, intent.composerEmail || null)
          return
        }

        setInSiteCheckout({
          topupId: intent.topupId,
          amount: Number(intent.amount) || totalPrice,
          email: intent.composerEmail || null,
          provider: 'mercadopago',
        })
        return
      }

      const response = await fetch('/api/compositores/studio/topup/preferencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ musicQuantity: normalizedMusicQuantity }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(t('payment.checkout.errors.start'))

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
      if (!checkoutUrl) throw new Error(t('payment.checkout.errors.noPaymentLink'))
      window.location.href = checkoutUrl
    } catch (err: any) {
      setError(err.message || t('payment.checkout.errors.start'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  const updateMusicQuantity = (quantity: number) => {
    const next = Math.max(1, Math.min(500, Math.floor(Number(quantity) || 1)))
    setMusicQuantity(next)
    setMusicQuantityDraft(String(next))
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
            <FiArrowLeft /> {t('payment.topup.backToStudio')}
          </Link>

          <section className="mb-8 rounded-3xl border border-purple-700/60 bg-gradient-to-br from-black via-gray-950 to-purple-950/70 p-8 sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-sm text-purple-100">
                  <FiZap /> {t('payment.topup.page.badge')}
                </span>
                <h1 className="text-4xl font-black sm:text-5xl">
                  {t('payment.topup.page.title')}
                </h1>
                <p className="mt-4 max-w-2xl text-gray-300">
                  {t('payment.topup.page.description')}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/50 p-5">
                <p className="text-sm text-gray-400">{t('payment.topup.page.balance')}</p>
                <p className="text-3xl font-black text-primary-300">{t('payment.topup.page.credits', { count: credits.remaining })}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('payment.topup.page.used', { used: credits.used, limit: credits.limit })}
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
                {t('payment.topup.page.quantityQuestion')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="off"
                value={musicQuantityDraft}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '')
                  if (digits === '') {
                    setMusicQuantityDraft('')
                    return
                  }
                  const parsed = Math.min(500, parseInt(digits, 10))
                  if (!Number.isFinite(parsed)) return
                  setMusicQuantityDraft(String(parsed))
                  if (parsed >= 1) {
                    setMusicQuantity(parsed)
                    setError('')
                  }
                }}
                onBlur={() => updateMusicQuantity(Number(musicQuantityDraft) || 1)}
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
                    {t('payment.topup.page.songs', { count: quantity })}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  {t('payment.topup.page.extraCredits', { count: totalCredits })}
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  {t('payment.topup.page.autoRelease')}
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" />
                  {t('payment.topup.page.securePayment')}
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border border-purple-500/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black p-6 sm:p-8">
              <p className="text-sm text-purple-200">{currentTier.label}</p>
              <p className="mt-3 text-5xl font-black text-white"><LocalizedMoney value={totalPrice} country={country} /></p>
              <p className="mt-2 text-lg text-primary-300">
                <LocalizedMoney value={currentTier.unitPrice} country={country} /> {t('payment.topup.page.perSong')}
              </p>
              <p className="mt-4 text-sm text-gray-400">
                {t('payment.topup.page.summary', { count: normalizedMusicQuantity })} <LocalizedMoney value={currentTier.unitPrice} country={country} />
              </p>

              <button
                type="button"
                onClick={startRedirectCheckout}
                disabled={checkoutLoading || currentTier.unitPrice <= 0}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-bold text-white hover:from-primary-500 hover:to-purple-500 disabled:opacity-60"
              >
                {checkoutLoading ? <FiLoader className="animate-spin" /> : <FiCreditCard />}
                {t('payment.topup.page.buy')}
              </button>

              <div className="mt-6 rounded-2xl border border-gray-800 bg-black/40 p-4 text-xs text-gray-400">
                {tiers.map((tier) => (
                  <p key={tier.label}>{tier.label}: <LocalizedMoney value={tier.unitPrice} country={country} /> {t('payment.topup.page.perSong')}</p>
                ))}
              </div>
            </aside>
          </div>

        </div>
      </div>
      {inSiteCheckout?.provider === 'stripe' && inSiteCheckout.stripeClientSecret && inSiteCheckout.stripePublishableKey ? (
        <StripePaymentOverlay
          clientSecret={inSiteCheckout.stripeClientSecret}
          publishableKey={inSiteCheckout.stripePublishableKey}
          onClose={() => setInSiteCheckout(null)}
          onComplete={async () => {
            const token = localStorage.getItem('composer_token')
            const response = await fetch('/api/compositores/studio/topup/sync', {
              method: 'POST',
              headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
              body: JSON.stringify({ topupId: inSiteCheckout.topupId, paymentId: inSiteCheckout.stripeSessionId }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(t('payment.topup.errors.confirm'))
            if (result.status === 'paid') {
              const params = new URLSearchParams({ topup_id: inSiteCheckout.topupId, payment_id: result.paymentId || '' })
              router.push(`/compositores/admin/studio-ia/recarga/sucesso?${params.toString()}`)
            }
          }}
        />
      ) : inSiteCheckout ? (
        <MercadoPagoPaymentOverlay
          amount={inSiteCheckout.amount}
          email={inSiteCheckout.email}
          onClose={() => setInSiteCheckout(null)}
          onUseFallback={() => openStripeFallback(inSiteCheckout.topupId, inSiteCheckout.amount, inSiteCheckout.email)}
          onSubmitPayment={async (formData) => {
            const token = localStorage.getItem('composer_token')
            const response = await fetch('/api/compositores/studio/topup/payment', {
              method: 'POST',
              headers: {
                Authorization: token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                topupId: inSiteCheckout.topupId,
                formData,
              }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(t('payment.checkout.errors.processing'))
            return result
          }}
          onCheckStatus={async (paymentId) => {
            const token = localStorage.getItem('composer_token')
            const response = await fetch('/api/compositores/studio/topup/sync', {
              method: 'POST',
              headers: {
                Authorization: token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                topupId: inSiteCheckout.topupId,
                paymentId,
              }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(t('payment.checkout.errors.checkPayment'))
            return result
          }}
          onPaid={(result) => {
            if (paidRedirectRef.current) return
            paidRedirectRef.current = true
            const params = new URLSearchParams()
            params.set('topup_id', result?.topupId || inSiteCheckout.topupId)
            if (result?.paymentId) params.set('payment_id', String(result.paymentId))
            router.push(`/compositores/admin/studio-ia/recarga/sucesso?${params.toString()}`)
          }}
        />
      ) : null}
    </div>
  )
}
