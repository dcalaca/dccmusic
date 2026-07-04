'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiArrowRight, FiCreditCard, FiFolder, FiGift, FiImage, FiLoader, FiMusic, FiX, FiZap } from 'react-icons/fi'
import { trackTikTokEvent } from '@/components/TikTokEvents'

const PROJECTS_URL = '/compositores/admin/studio-ia/projetos'
const STUDIO_MUSIC_CREDITS = 10
const SHOW_ACTIVE_NOTICE_EVENT = 'showActiveNotice'
const STUDIO_PLAN_TIKTOK_VALUES: Record<string, { name: string; value: number }> = {
  'studio-start': { name: 'Studio Start', value: 19.90 },
  'studio-pro': { name: 'Studio Pro', value: 29.90 },
  'studio-elite': { name: 'Studio Elite', value: 59.90 },
  'dcc-studio-ia': { name: 'Plano DCC Studio IA', value: 19.90 },
}

function loginUrl(redirectTo: string) {
  return `/compositores/login?redirect=${encodeURIComponent(redirectTo)}`
}

async function getComposerStudioBalance(token: string) {
  const response = await fetch('/api/compositores/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) return null

  const data = await response.json()
  const statementBalance = Number(data?.statement?.summary?.currentCreditBalance)
  const currentCreditBalance = Number.isFinite(statementBalance)
    ? Math.max(0, statementBalance)
    : Math.max(0, Number(data?.studio?.creditsRemaining) || 0)
  const freeMusicRemaining = Number(data?.studio?.freeMusicRemaining) || 0
  const hasStudioPlan = Boolean(data?.plan?.hasStudioPlan)

  return {
    canCreateMusic: currentCreditBalance >= STUDIO_MUSIC_CREDITS || freeMusicRemaining > 0,
    freeMusicRemaining,
    currentCreditBalance,
    planCreditsRemaining: currentCreditBalance,
    hasStudioPlan,
  }
}

async function getStudioStatus() {
  const token = localStorage.getItem('composer_token')
  if (!token) return null

  const response = await fetch('/api/compositores/studio/status', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) return getComposerStudioBalance(token)

  const data = await response.json()
  const currentCreditBalance = Number(data?.credits?.remaining) || 0
  const freeMusicRemaining = Number(data?.stats?.freeMusicRemaining) || 0
  const planCreditsRemaining = Number(data?.credits?.remaining) || 0
  const hasStudioPlan = Boolean(data?.hasStudioPlan)
  const canCreateMusic = Boolean(data?.canCreateMusic) || currentCreditBalance >= STUDIO_MUSIC_CREDITS || freeMusicRemaining > 0

  if (!canCreateMusic) {
    const fallbackStatus = await getComposerStudioBalance(token)
    if (fallbackStatus?.canCreateMusic) return fallbackStatus
  }

  return {
    canCreateMusic,
    freeMusicRemaining,
    currentCreditBalance,
    planCreditsRemaining,
    hasStudioPlan,
  }
}

function showActiveNotice() {
  window.dispatchEvent(new Event(SHOW_ACTIVE_NOTICE_EVENT))
}

export function StudioHeroActions() {
  const router = useRouter()
  const [checkingCreate, setCheckingCreate] = useState(false)
  const [showUsedFreeModal, setShowUsedFreeModal] = useState(false)

  const goToProjects = () => {
    const token = localStorage.getItem('composer_token')
    router.push(token ? PROJECTS_URL : loginUrl(PROJECTS_URL))
  }

  const goToCoverArt = () => {
    const token = localStorage.getItem('composer_token')
    const coverUrl = '/compositores/admin/studio-ia/criar-capa'
    router.push(token ? coverUrl : loginUrl(coverUrl))
  }

  const goToImproveMusic = () => {
    const token = localStorage.getItem('composer_token')
    const improveUrl = '/compositores/admin/studio-ia/melhorar'
    router.push(token ? improveUrl : loginUrl(improveUrl))
  }

  const createMusic = async () => {
    const token = localStorage.getItem('composer_token')
    if (token) {
      showActiveNotice()
    }

    if (!token) {
      router.push(loginUrl('/compositores/admin/studio-ia/novo'))
      return
    }

    setCheckingCreate(true)
    try {
      const status = await getStudioStatus()

      if (!status || !status.canCreateMusic) {
        setShowUsedFreeModal(true)
        window.setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 50)
        return
      }

      router.push('/compositores/admin/studio-ia/novo')
    } finally {
      setCheckingCreate(false)
    }
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-2 sm:max-w-none sm:flex-row">
        <button
          type="button"
          onClick={createMusic}
          disabled={checkingCreate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 via-purple-600 to-fuchsia-600 px-5 py-3 text-sm font-black text-white shadow-2xl shadow-purple-950/40 transition hover:scale-[1.02] sm:w-auto sm:px-6 sm:text-base"
        >
          {checkingCreate ? (
            <>
              <FiLoader className="animate-spin" /> Verificando...
            </>
          ) : (
            <>
              Criar música <FiArrowRight />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={goToImproveMusic}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/70 bg-purple-950/45 px-5 py-3 text-sm font-semibold text-white transition hover:border-purple-300 sm:w-auto sm:px-6 sm:text-base"
        >
          <FiZap /> Melhorar música
        </button>
        <button
          type="button"
          onClick={goToCoverArt}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/70 bg-fuchsia-950/45 px-5 py-3 text-sm font-semibold text-white transition hover:border-fuchsia-300 sm:w-auto sm:px-6 sm:text-base"
        >
          <FiImage /> Criar Capa
        </button>
        <button
          type="button"
          onClick={goToProjects}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/60 bg-purple-950/50 px-5 py-3 text-sm font-semibold text-white transition hover:border-purple-300 sm:w-auto sm:px-6 sm:text-base"
        >
          <FiFolder /> Meus Projetos
        </button>
        <a href="#planos" className="inline-flex w-full items-center justify-center rounded-2xl border border-gray-700 bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-purple-400 sm:w-auto sm:px-6 sm:text-base">
          Ver Planos
        </a>
      </div>

      {showUsedFreeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-purple-600/70 bg-gradient-to-br from-gray-950 via-purple-950/80 to-black p-7 text-center shadow-2xl shadow-purple-950/70">
            <div className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
            <button
              type="button"
              onClick={() => setShowUsedFreeModal(false)}
              className="absolute right-4 top-4 rounded-full border border-gray-700 bg-black/40 p-2 text-gray-300 hover:text-white"
              aria-label="Fechar"
            >
              <FiX />
            </button>

            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-200">
              <FiZap className="h-8 w-8" />
            </div>
            <h2 className="relative text-3xl font-black text-white">Você está sem saldo no Studio IA</h2>
            <p className="relative mt-3 text-sm leading-relaxed text-purple-100/90">
              Você já usou sua música grátis e está sem saldo. Para continuar criando, escolha um plano ou compre uma recarga avulsa.
            </p>

            <div className="relative mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUsedFreeModal(false)
                  router.push('/studio-ia#planos')
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
              >
                <FiZap />
                Ver planos
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUsedFreeModal(false)
                  router.push('/compositores/admin/studio-ia/recarga')
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-600/70 bg-purple-950/40 px-5 py-3 font-bold text-purple-100 hover:bg-purple-900/50"
              >
                <FiCreditCard />
                Comprar recarga avulsa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function StudioTopupButton() {
  const router = useRouter()

  const handleClick = () => {
    const token = localStorage.getItem('composer_token')
    const destination = '/compositores/admin/studio-ia/recarga'
    trackTikTokEvent('InitiateCheckout', {
      content_id: 'studio_topup',
      content_name: 'Recarga Studio IA',
      content_category: 'Studio IA',
      event_id: `initiate_checkout:studio_topup:${Date.now()}`,
      currency: 'BRL',
      price: 1.99,
      quantity: 1,
      value: 1.99,
    })
    router.push(token ? destination : loginUrl(destination))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/60 bg-purple-950/40 px-5 py-3 font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-900/50"
    >
      <FiCreditCard />
      Comprar Recarga Avulsa
    </button>
  )
}

export function StudioCouponButton() {
  const router = useRouter()

  const handleClick = () => {
    const token = localStorage.getItem('composer_token')
    const destination = '/compositores/admin/studio-ia/cupom'
    router.push(token ? destination : loginUrl(destination))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/50 bg-amber-950/30 px-5 py-3 font-bold text-amber-100 transition hover:border-amber-300 hover:bg-amber-900/40"
    >
      <FiGift />
      Você tem cupom?
    </button>
  )
}

export function StudioPlanButton({ planSlug }: { planSlug: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    const token = localStorage.getItem('composer_token')
    const checkoutUrl = `/compositores/checkout?plan=${planSlug}`
    const planEventData = STUDIO_PLAN_TIKTOK_VALUES[planSlug] || {
      name: 'Plano DCC Studio IA',
      value: 19.90,
    }
    const checkoutEvent = {
      content_id: planSlug,
      content_name: planEventData.name,
      content_category: 'Studio IA',
      currency: 'BRL',
      event_id: `initiate_checkout:${planSlug}:${Date.now()}`,
      price: planEventData.value,
      quantity: 1,
      value: planEventData.value,
    }

    if (!token) {
      trackTikTokEvent('InitiateCheckout', checkoutEvent)
      router.push(loginUrl(checkoutUrl))
      return
    }

    setLoading(true)
    try {
      const status = await getStudioStatus()
      if (status?.hasStudioPlan) {
        router.push(PROJECTS_URL)
        return
      }

      trackTikTokEvent('InitiateCheckout', checkoutEvent)
      router.push(checkoutUrl)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white transition hover:scale-[1.01] disabled:opacity-70"
    >
      {loading ? (
        <>
          <FiLoader className="animate-spin" /> Verificando plano...
        </>
      ) : (
        '✨ Assinar Studio IA'
      )}
    </button>
  )
}

export function FreeMusicPlanNotice() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const loadStatus = async () => {
      const token = localStorage.getItem('composer_token')
      setIsLoggedIn(Boolean(token))

      if (!token) {
        setLoading(false)
        return
      }

      const status = await getStudioStatus()
      setRemaining(status?.freeMusicRemaining ?? 0)
      setLoading(false)
    }

    loadStatus()
  }, [])

  const handleClick = () => {
    const destination = remaining && remaining > 0
      ? '/compositores/admin/studio-ia/novo'
      : '/studio-ia#planos'

    if (!isLoggedIn) {
      router.push(loginUrl('/compositores/admin/studio-ia/novo'))
      return
    }

    showActiveNotice()
    router.push(destination)
  }

  const text = !isLoggedIn
    ? 'Entre para ver seu saldo e começar a criar.'
    : remaining !== null && remaining > 0
      ? 'Você ainda tem uma música grátis para testar, clique aqui.'
      : 'Você já usou sua música grátis, veja os planos ou compre recarga avulsa.'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="mx-auto mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-500/60 bg-purple-950/40 px-5 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-900/50 disabled:opacity-70"
    >
      {loading ? <FiLoader className="animate-spin" /> : <FiMusic />}
      {loading ? 'Verificando música grátis...' : text}
    </button>
  )
}
