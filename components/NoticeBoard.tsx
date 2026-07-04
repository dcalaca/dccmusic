'use client'

import { useCallback, useEffect, useState } from 'react'
import { FiBell, FiX } from 'react-icons/fi'

type ActiveNotice = {
  id: string
  title: string
  message: string
  updatedAt: string
}

const SHOW_ACTIVE_NOTICE_EVENT = 'showActiveNotice'

function hasLoggedUser() {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    return true
  }

  return Boolean(
    localStorage.getItem('composer_token') ||
    localStorage.getItem('site_user_token')
  )
}

export default function NoticeBoard() {
  const [notice, setNotice] = useState<ActiveNotice | null>(null)
  const [visible, setVisible] = useState(false)

  const loadNotice = useCallback(async (options?: { ignoreDismiss?: boolean }) => {
    if (!hasLoggedUser()) {
      setVisible(false)
      setNotice(null)
      return
    }

    try {
      const response = await fetch('/api/notices/active', { cache: 'no-store' })
      if (!response.ok) return

      const data = await response.json()
      const activeNotice = data.notice as ActiveNotice | null
      if (!activeNotice) {
        setVisible(false)
        setNotice(null)
        return
      }

      const dismissKey = `dcc_notice_dismissed_${activeNotice.id}_${activeNotice.updatedAt}`
      if (!options?.ignoreDismiss && localStorage.getItem(dismissKey) === 'true') return

      setNotice(activeNotice)
      setVisible(true)
    } catch {
      // Aviso não deve atrapalhar navegação se falhar.
    }
  }, [])

  useEffect(() => {
    const loadDefaultNotice = () => {
      void loadNotice()
    }
    const showActiveNotice = () => {
      void loadNotice({ ignoreDismiss: true })
    }

    loadDefaultNotice()

    window.addEventListener('authChange', loadDefaultNotice)
    window.addEventListener('noticeBoardChange', loadDefaultNotice)
    window.addEventListener(SHOW_ACTIVE_NOTICE_EVENT, showActiveNotice)
    window.addEventListener('focus', loadDefaultNotice)

    return () => {
      window.removeEventListener('authChange', loadDefaultNotice)
      window.removeEventListener('noticeBoardChange', loadDefaultNotice)
      window.removeEventListener(SHOW_ACTIVE_NOTICE_EVENT, showActiveNotice)
      window.removeEventListener('focus', loadDefaultNotice)
    }
  }, [loadNotice])

  const closeNotice = () => {
    if (notice) {
      localStorage.setItem(`dcc_notice_dismissed_${notice.id}_${notice.updatedAt}`, 'true')
    }
    setVisible(false)
  }

  if (!visible || !notice) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-purple-600/70 bg-gradient-to-br from-gray-950 via-purple-950/80 to-black p-6 shadow-2xl shadow-purple-950/60 sm:p-8">
        <div className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
        <button
          type="button"
          onClick={closeNotice}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/40 p-2 text-gray-300 hover:bg-white/10 hover:text-white"
          aria-label="Fechar aviso"
        >
          <FiX />
        </button>

        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-100">
          <FiBell className="h-7 w-7" />
        </div>
        <h2 className="relative pr-8 text-2xl font-black text-white">{notice.title}</h2>
        <p className="relative mt-4 whitespace-pre-wrap text-sm leading-relaxed text-purple-100/90">
          {notice.message}
        </p>
        <button
          type="button"
          onClick={closeNotice}
          className="relative mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
