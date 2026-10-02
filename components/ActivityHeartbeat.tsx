'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function ActivityHeartbeat() {
  const pathname = usePathname()
  const lastPing = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    const ping = async () => {
      if (document.hidden || inFlight.current) return
      if (Date.now() - lastPing.current < 60000) return
      const composerToken = localStorage.getItem('composer_token')
      const siteUserToken = localStorage.getItem('site_user_token')
      const token = composerToken || siteUserToken
      if (!token) return

      lastPing.current = Date.now()
      inFlight.current = true
      await fetch('/api/activity/ping', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType: composerToken ? 'composer' : 'site_user',
          path: window.location.pathname,
        }),
      }).catch(() => null).finally(() => { inFlight.current = false })
    }

    ping()
    const interval = window.setInterval(ping, 60 * 1000)
    const handleFocus = () => ping()
    const handleVisibility = () => {
      if (!document.hidden) ping()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pathname])

  return null
}
