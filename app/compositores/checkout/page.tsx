'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiExternalLink, FiLoader, FiMusic, FiUploadCloud, FiZap } from 'react-icons/fi'
import { trackTikTokEvent } from '@/components/TikTokEvents'
import { MercadoPagoPaymentOverlay } from '@/components/MercadoPagoCheckout'
import { isMercadoPagoInSiteCheckoutEnabled } from '@/lib/mp-in-site-checkout'
import { StripePaymentOverlay } from '@/components/StripeCheckout'
import { useLocalization } from '@/components/LocalizationProvider'

function CheckoutContent() {
  const router = useRouter()
  const { country, paymentProvider } = useLocalization()
  const searchParams = useSearchParams()
  const planSlug = searchParams.get('plan')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preferenceId, setPreferenceId] = useState('')
  const [initPoint, setInitPoint] = useState('')
  const [readyToConfirm, setReadyToConfirm] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [alreadyHasStudioPlan, setAlreadyHasStudioPlan] = useState(false)
  const [currentStudioPlanName, setCurrentStudioPlanName] = useState('')
  const [inSiteCheckout, setInSiteCheckout] = useState<{
    subscriptionId: string
    amount: number
    email?: string | null
    provider: 'mercadopago' | 'stripe'
    stripeClientSecret?: string
    stripePublishableKey?: string
  } | null>(null)
  const paidRedirectRef = useRef(false)

  const isStudioPlan = (slug: string | null) => {
    if (!slug) return false
    return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(slug) || slug.includes('studio')
  }

  useEffect(() => {
    if (!inSiteCheckout) {
      paidRedirectRef.current = false
      return
    }

    let cancelled = false
    let inFlight = false

    const goToSuccess = (data?: { subscriptionId?: string; paymentId?: string | null }) => {
      if (paidRedirectRef.current) return
      paidRedirectRef.current = true
      const params = new URLSearchParams()
      params.set('subscription_id', data?.subscriptionId || inSiteCheckout.subscriptionId)
      if (data?.paymentId) params.set('payment_id', String(data.paymentId))
      router.push(`/compositores/pagamento/sucesso?${params.toString()}`)
    }

    const checkWebhookStatus = async () => {
      if (cancelled || inFlight || paidRedirectRef.current) return
      const token = localStorage.getItem('composer_token')
      if (!token) return

      inFlight = true
      try {
        const response = await fetch(
          `/api/compositores/pagamento/status?subscriptionId=${encodeURIComponent(inSiteCheckout.subscriptionId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        )
        const data = await response.json()
        if (cancelled || !response.ok) return
        if (data.status === 'paid' || data.status === 'active' || data.status === 'approved') {
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

  const createPreference = async () => {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('composer_token')
      const composerData = JSON.parse(localStorage.getItem('composer_data') || '{}')
      if (!token) {
        const redirect = planSlug ? `/compositores/checkout?plan=${planSlug}` : '/compositores/checkout'
        router.push(`/compositores/login?redirect=${encodeURIComponent(redirect)}`)
        return
      }

      const trackInitiate = (data: any) => {
        const metaEventId = data.metaInitiateCheckoutEventId || `initiate_checkout:${planSlug || 'composer_plan'}:${data.preferenceId || data.subscriptionId || Date.now()}`
        const productId = data.planId || planSlug || 'composer_plan'
        const productName = data.planName || (isStudioPlan(planSlug) ? 'Plano DCC Studio IA' : 'Compositor Premium')
        const planPrice = Number(data.planPrice || data.amount) || 0
        const fbq = (window as any).fbq
        if (typeof fbq === 'function') {
          fbq('track', 'InitiateCheckout', {
            content_id: productId,
            content_name: productName,
            content_type: 'product',
            contents: [{
              id: productId,
              quantity: 1,
            }],
            currency: 'BRL',
            value: planPrice,
          }, {
            eventID: metaEventId,
          })
        }
        trackTikTokEvent('InitiateCheckout', {
          content_id: productId,
          content_name: productName,
          content_category: isStudioPlan(planSlug) ? 'Studio IA' : 'Compositores Premium',
          currency: 'BRL',
          event_id: metaEventId,
          price: planPrice,
          quantity: 1,
          value: planPrice,
        })
      }

      if (paymentProvider === 'stripe' || isMercadoPagoInSiteCheckoutEnabled()) {
        const intentResponse = await fetch('/api/compositores/pagamento/intent', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ planId: planSlug, provider: paymentProvider, country }),
        })
        const intent = await intentResponse.json()
        if (!intentResponse.ok) throw new Error(intent.error || 'Erro ao iniciar pagamento')
        trackInitiate(intent)
        if (intent.provider === 'stripe') {
          const stripeResponse = await fetch('/api/compositores/pagamento/stripe/session', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ planId: planSlug, subscriptionId: intent.subscriptionId }),
          })
          const stripe = await stripeResponse.json()
          if (!stripeResponse.ok) throw new Error(stripe.error || 'Erro ao abrir Stripe')
          setInSiteCheckout({
            subscriptionId: stripe.subscriptionId,
            amount: Number(stripe.amount || intent.amount || intent.planPrice) || 0,
            email: intent.composerEmail || null,
            provider: 'stripe',
            stripeClientSecret: stripe.clientSecret,
            stripePublishableKey: stripe.publishableKey,
          })
        } else {
          setInSiteCheckout({
            subscriptionId: intent.subscriptionId,
            amount: Number(intent.amount || intent.planPrice) || 0,
            email: intent.composerEmail || null,
            provider: 'mercadopago',
          })
        }
        return
      }

      const response = await fetch('/api/compositores/pagamento/preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          composerId: composerData.id || composerData.slug,
          planId: planSlug,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar preferência de pagamento')
      }

      setPreferenceId(data.preferenceId)
      const initPointUrl = data.initPoint || data.sandboxInitPoint
      setInitPoint(initPointUrl)
      trackInitiate(data)

      if (!initPointUrl) throw new Error('Mercado Pago não retornou o link de pagamento.')
      window.location.href = initPointUrl
    } catch (err: any) {
      console.error('[CHECKOUT] Erro:', err)
      const errorMessage = err.message || 'Erro ao processar pagamento. Tente novamente.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Verificar se compositor está logado
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      const redirect = planSlug ? `/compositores/checkout?plan=${planSlug}` : '/compositores/checkout'
      router.push(`/compositores/login?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    const startCheckout = async () => {
      if (!planSlug) {
        setError('Plano não informado. Volte para a página de planos e escolha uma opção.')
        setCheckingAccess(false)
        return
      }

      if (isStudioPlan(planSlug)) {
        try {
          const statusResponse = await fetch('/api/compositores/studio/status', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const status = await statusResponse.json()

          // Só interrompe se existir plano Studio IA mensal ativo.
          // Crédito avulso / música grátis não conta como plano.
          if (statusResponse.ok && status?.hasStudioPlan) {
            setAlreadyHasStudioPlan(true)
            setCurrentStudioPlanName(status.planName || 'Studio IA')
            setCheckingAccess(false)
            return
          }
        } catch (error) {
          console.error('[CHECKOUT] Erro ao verificar plano Studio:', error)
        }
      }

      setReadyToConfirm(true)
      setCheckingAccess(false)
    }

    startCheckout()
  }, [planSlug, router])

  const planIsStudio = isStudioPlan(planSlug)
  const confirmationCopy = planIsStudio
    ? {
        icon: FiMusic,
        badge: 'DCC Studio IA',
        title: 'Você está assinando o DCC Studio IA',
        description: 'Este plano é para criar letras, músicas, capas e projetos usando inteligência artificial.',
        includes: [
          'Criação de músicas com IA dentro do Studio IA',
          'Créditos mensais conforme o plano escolhido',
          'Organização dos seus projetos criados com IA',
        ],
        warning: 'Se sua intenção é apenas cadastrar músicas prontas do Spotify, SoundCloud ou outros players, escolha Compositor Premium.',
        confirmLabel: 'Confirmar e pagar Studio IA',
        alternativeHref: '/compositores/planos#compositor-premium',
        alternativeLabel: 'Quero Compositor Premium',
      }
    : {
        icon: FiUploadCloud,
        badge: 'Compositor Premium',
        title: 'Atenção: este não é o plano Studio IA',
        description: 'Você está comprando um plano de Compositor Premium, feito para publicar e divulgar músicas que você já tem prontas.',
        includes: [
          'Cadastrar músicas prontas com link/player externo',
          'Cadastrar vídeos e organizar sua página de compositor',
          'Recursos de divulgação dentro do DCC Music',
        ],
        warning: 'Este plano não libera créditos mensais para criar músicas com IA. Para criar músicas novas com IA, escolha um plano DCC Studio IA.',
        confirmLabel: 'Entendi, quero Compositor Premium',
        alternativeHref: '/compositores/planos',
        alternativeLabel: 'Quero Studio IA',
      }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            {checkingAccess ? (
              <div className="text-center py-8">
                <FiLoader className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Verificando seu acesso...</p>
                <p className="text-gray-500 text-sm">Aguarde alguns segundos</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <FiLoader className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Processando pagamento...</p>
                <p className="text-gray-500 text-sm">Aguarde enquanto preparamos seu checkout</p>
              </div>
            ) : alreadyHasStudioPlan ? (
              <div className="py-2">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/50 bg-green-500/15 px-3 py-1 text-xs font-bold text-green-100">
                  <FiCheckCircle />
                  Plano ativo
                </div>
                <h1 className="mb-3 text-2xl font-black text-white">Você já tem um plano Studio IA</h1>
                <p className="mb-5 text-sm leading-relaxed text-gray-300">
                  Seu plano atual é <strong className="text-white">{currentStudioPlanName}</strong>.
                  Se clicou em outro plano querendo mais músicas, o caminho certo é a recarga avulsa.
                </p>
                <div className="mb-6 rounded-2xl border border-purple-700/60 bg-purple-950/25 p-4 text-sm text-purple-100">
                  A recarga avulsa soma créditos extras sem trocar o plano mensal.
                </div>
                <div className="space-y-3">
                  <Link
                    href="/compositores/admin/studio-ia/recarga"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-bold text-white transition-all hover:from-primary-700 hover:to-purple-700"
                  >
                    <FiZap />
                    Ir para recarga avulsa
                  </Link>
                  <Link
                    href="/compositores/admin/studio-ia/projetos"
                    className="flex w-full items-center justify-center rounded-xl border border-gray-700 px-5 py-3 font-semibold text-gray-200 transition-colors hover:border-primary-500 hover:text-primary-300"
                  >
                    Voltar ao Studio IA
                  </Link>
                  <Link
                    href="/compositores/planos"
                    className="flex w-full items-center justify-center text-sm text-gray-400 hover:text-primary-300"
                  >
                    Ver todos os planos
                  </Link>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
                <Link
                  href="/compositores/planos"
                  className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  <span>Voltar para planos</span>
                </Link>
              </div>
            ) : readyToConfirm && !preferenceId ? (
              <div className="py-2">
                <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
                  planIsStudio
                    ? 'border-purple-400/50 bg-purple-500/15 text-purple-100'
                    : 'border-yellow-400/50 bg-yellow-500/15 text-yellow-100'
                }`}>
                  {planIsStudio ? <FiMusic /> : <FiUploadCloud />}
                  {confirmationCopy.badge}
                </div>
                <h1 className="mb-3 text-2xl font-black text-white">{confirmationCopy.title}</h1>
                <p className="mb-5 text-sm leading-relaxed text-gray-300">{confirmationCopy.description}</p>

                <div className="mb-5 rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-100">
                    <FiCheckCircle className="text-green-300" />
                    O que este plano libera:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {confirmationCopy.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`mb-6 rounded-2xl border p-4 text-sm ${
                  planIsStudio
                    ? 'border-blue-700/60 bg-blue-950/25 text-blue-100'
                    : 'border-yellow-700/60 bg-yellow-950/25 text-yellow-100'
                }`}>
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <FiAlertTriangle />
                    Confira antes de pagar
                  </div>
                  <p>{confirmationCopy.warning}</p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={createPreference}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-bold text-white transition-all hover:from-primary-700 hover:to-purple-700"
                  >
                    <FiCheckCircle />
                    {confirmationCopy.confirmLabel}
                  </button>
                  <Link
                    href={confirmationCopy.alternativeHref}
                    className="flex w-full items-center justify-center rounded-xl border border-gray-700 px-5 py-3 font-semibold text-gray-200 transition-colors hover:border-primary-500 hover:text-primary-300"
                  >
                    {confirmationCopy.alternativeLabel}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                {preferenceId ? (
                  <div>
                    <p className="text-gray-400 mb-4">
                      Redirecionando para o Mercado Pago...
                    </p>
                    {initPoint && (
                      <div className="space-y-4">
                        <a
                          href={initPoint}
                          className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
                        >
                          <span>Ir para Pagamento</span>
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                        <p className="text-gray-500 text-xs mt-4">
                          Se não for redirecionado automaticamente, clique no botão acima
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-400 mb-4">
                      Preparando checkout...
                    </p>
                    <FiLoader className="w-8 h-8 text-primary-400 animate-spin mx-auto" />
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Informações de segurança */}
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-xs">
              🔒 Pagamento seguro processado pelo {paymentProvider === 'stripe' ? 'Stripe' : 'Mercado Pago'}
            </p>
          </div>
        </div>
      </div>
      {inSiteCheckout?.provider === 'mercadopago' ? (
        <MercadoPagoPaymentOverlay
          amount={inSiteCheckout.amount}
          email={inSiteCheckout.email}
          onClose={() => setInSiteCheckout(null)}
          onSubmitPayment={async (formData) => {
            const token = localStorage.getItem('composer_token')
            const response = await fetch('/api/compositores/pagamento/payment', {
              method: 'POST',
              headers: {
                Authorization: token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                subscriptionId: inSiteCheckout.subscriptionId,
                formData,
              }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Erro ao processar pagamento')
            return result
          }}
          onCheckStatus={async (paymentId) => {
            const token = localStorage.getItem('composer_token')
            const response = await fetch(
              `/api/compositores/pagamento/status?subscriptionId=${encodeURIComponent(inSiteCheckout.subscriptionId)}`,
              {
                headers: { Authorization: token ? `Bearer ${token}` : '' },
                cache: 'no-store',
              }
            )
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Erro ao conferir pagamento')
            if (paymentId && !result.paymentId) result.paymentId = paymentId
            return result
          }}
          onPaid={(result) => {
            if (paidRedirectRef.current) return
            paidRedirectRef.current = true
            const params = new URLSearchParams()
            params.set('subscription_id', result?.subscriptionId || inSiteCheckout.subscriptionId)
            if (result?.paymentId) params.set('payment_id', String(result.paymentId))
            router.push(`/compositores/pagamento/sucesso?${params.toString()}`)
          }}
        />
      ) : null}
      {inSiteCheckout?.provider === 'stripe' && inSiteCheckout.stripeClientSecret && inSiteCheckout.stripePublishableKey ? (
        <StripePaymentOverlay
          clientSecret={inSiteCheckout.stripeClientSecret}
          publishableKey={inSiteCheckout.stripePublishableKey}
          onClose={() => setInSiteCheckout(null)}
          onComplete={() => {
            if (paidRedirectRef.current) return
            paidRedirectRef.current = true
            const params = new URLSearchParams({ subscription_id: inSiteCheckout.subscriptionId })
            router.push(`/compositores/pagamento/sucesso?${params.toString()}`)
          }}
        />
      ) : null}
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
