'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiExternalLink, FiLoader, FiMusic, FiUploadCloud } from 'react-icons/fi'
import { trackTikTokEvent } from '@/components/TikTokEvents'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planSlug = searchParams.get('plan')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preferenceId, setPreferenceId] = useState('')
  const [initPoint, setInitPoint] = useState('')
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [readyToConfirm, setReadyToConfirm] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  const isStudioPlan = (slug: string | null) => {
    if (!slug) return false
    return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(slug) || slug.includes('studio')
  }

  // Carregar SDK do Mercado Pago
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => setSdkLoaded(true)
    script.onerror = () => {
      console.warn('SDK do Mercado Pago não carregado, usando redirecionamento direto')
      setSdkLoaded(false)
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const createPreference = async () => {
    setLoading(true)
    setError('')

    try {
      const composerData = JSON.parse(localStorage.getItem('composer_data') || '{}')

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
      const metaEventId = data.metaInitiateCheckoutEventId || `initiate_checkout:${planSlug || 'composer_plan'}:${data.preferenceId || Date.now()}`
      const productId = data.planId || planSlug || 'composer_plan'
      const productName = data.planName || (isStudioPlan(planSlug) ? 'Plano DCC Studio IA' : 'Compositor Premium')
      const planPrice = Number(data.planPrice) || 0
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
        event_id: `initiate_checkout:${planSlug || 'composer_plan'}:${data.preferenceId || Date.now()}`,
        price: planPrice,
        quantity: 1,
        value: planPrice,
      })

      // Redirecionar para o Mercado Pago (método mais confiável)
      // O SDK pode ser usado no futuro se necessário, mas redirecionamento é mais simples e confiável
      if (initPointUrl) {
        // Pequeno delay para melhorar UX
        setTimeout(() => {
          window.location.href = initPointUrl
        }, 500)
      }
    } catch (err: any) {
      console.error('[CHECKOUT] Erro:', err)
      const errorMessage = err.message || 'Erro ao processar pagamento. Tente novamente.'
      setError(errorMessage)
      
      // Log adicional para debug
      if (err.message?.includes('Token') || err.message?.includes('token')) {
        console.error('[CHECKOUT] Possível problema com token do Mercado Pago')
      }
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

          if (statusResponse.ok && status?.allowed) {
            router.replace('/compositores/admin/studio-ia/projetos')
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
              🔒 Pagamento seguro processado pelo Mercado Pago
            </p>
          </div>
        </div>
      </div>
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
