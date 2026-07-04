'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'dcc_partner_attribution'

function track(eventType: string, metadata?: Record<string, any>) {
  fetch('/api/partners/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, metadata }),
  }).catch(() => null)
}

export default function PartnerAttribution() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const trackedRef = useRef(false)

  useEffect(() => {
    const partnerCode = searchParams.get('partner')

    if (partnerCode) {
      fetch('/api/partners/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode,
          path: window.location.pathname + window.location.search,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data?.attributed && data?.partner) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.partner))
          }
        })
        .catch(() => null)
    } else if (!trackedRef.current) {
      trackedRef.current = true
      track('page_view', { path: window.location.pathname })
    }
  }, [pathname, searchParams])

  useEffect(() => {
    let moved = false
    let scrolled = false
    let stayed = false

    const handleMouseMove = () => {
      if (moved) return
      moved = true
      track('mouse_movement', { path: window.location.pathname })
    }

    const handleScroll = () => {
      if (scrolled) return
      scrolled = true
      track('scroll', { path: window.location.pathname })
    }

    const timeout = window.setTimeout(() => {
      if (stayed) return
      stayed = true
      track('button_click', { path: window.location.pathname, signal: 'time_over_10s' })
    }, 10_000)

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

  return null
}

export function getStoredPartnerAttribution() {
  if (typeof window === 'undefined') return null
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!data?.code || !data?.expiresAt) return null
    if (new Date(data.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function trackPartnerEvent(eventType: string, metadata?: Record<string, any>) {
  track(eventType, metadata)
}

