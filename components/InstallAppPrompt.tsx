'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { FiDownload, FiShare2, FiX } from 'react-icons/fi'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_AT_KEY = 'dcc_install_prompt_dismissed_at'
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000

const copyByLanguage = {
  pt: {
    title: 'Tenha a DCC Music na tela inicial',
    androidBody: 'Acesse como um aplicativo, direto da tela do seu celular.',
    iosBody: 'Adicione a DCC Music à tela inicial para acessar mais rápido.',
    install: 'Instalar agora',
    howTo: 'Como adicionar',
    iosStep: 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.',
    close: 'Fechar',
  },
  es: {
    title: 'Ten DCC Music en tu pantalla de inicio',
    androidBody: 'Accede como una aplicación, directamente desde la pantalla de tu móvil.',
    iosBody: 'Añade DCC Music a tu pantalla de inicio para acceder más rápido.',
    install: 'Instalar ahora',
    howTo: 'Cómo añadir',
    iosStep: 'En Safari, toca Compartir y después “Añadir a pantalla de inicio”.',
    close: 'Cerrar',
  },
  en: {
    title: 'Keep DCC Music on your Home Screen',
    androidBody: 'Open it like an app, straight from your phone Home Screen.',
    iosBody: 'Add DCC Music to your Home Screen for faster access.',
    install: 'Install now',
    howTo: 'How to add',
    iosStep: 'In Safari, tap Share, then “Add to Home Screen”.',
    close: 'Close',
  },
} as const

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function wasRecentlyDismissed() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_AT_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS
  } catch {
    return false
  }
}

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [language, setLanguage] = useState<'pt' | 'es' | 'en'>('pt')

  const copy = useMemo(() => copyByLanguage[language], [language])

  useEffect(() => {
    const lang = document.documentElement.lang.toLowerCase()
    setLanguage(lang.startsWith('es') ? 'es' : lang.startsWith('en') ? 'en' : 'pt')

    if (window.location.hostname.startsWith('blog.')) return
    if (isStandalone() || wasRecentlyDismissed()) return

    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    const android = /android/.test(ua)
    setIsIOS(ios)

    let showTimer: ReturnType<typeof setTimeout> | null = null

    if (ios) {
      showTimer = setTimeout(() => setVisible(true), 6000)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const installEvent = event as BeforeInstallPromptEvent
      setDeferredPrompt(installEvent)

      if (android || window.matchMedia('(pointer: coarse)').matches) {
        showTimer = setTimeout(() => setVisible(true), 5000)
      }
    }

    const handleAppInstalled = () => {
      setVisible(false)
      setDeferredPrompt(null)
      try {
        window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
      } catch {}
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      if (showTimer) clearTimeout(showTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
    } catch {}
  }

  const install = async () => {
    if (isIOS) {
      setShowIOSHelp(true)
      return
    }

    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setVisible(false)
    } else {
      dismiss()
    }

    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md rounded-2xl border border-white/10 bg-gray-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl sm:bottom-5 sm:p-4"
      aria-label={copy.title}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
        aria-label={copy.close}
      >
        <FiX className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black p-1.5">
          <Image
            src="/favicon-dcc-fundopreto.png"
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 rounded-lg"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white sm:text-base">{copy.title}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-300 sm:text-sm">
            {isIOS ? copy.iosBody : copy.androidBody}
          </p>

          {showIOSHelp ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-gray-200">
              <FiShare2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
              <span>{copy.iosStep}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white transition hover:from-primary-700 hover:to-purple-700 sm:text-sm"
            >
              {isIOS ? <FiShare2 className="h-4 w-4" /> : <FiDownload className="h-4 w-4" />}
              {isIOS ? copy.howTo : copy.install}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
