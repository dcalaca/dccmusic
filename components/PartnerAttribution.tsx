'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'dcc_partner_attribution'

export default function PartnerAttribution() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const attributedEntryRef = useRef<string | null>(null)

  useEffect(() => {
    const partnerCode = searchParams.get('partner')
    const serverTracked = searchParams.get('partnerTracked') === '1'

    if (partnerCode) {
      const entry = window.location.pathname + window.location.search
      if (attributedEntryRef.current === entry) return
      attributedEntryRef.current = entry

      fetch('/api/partners/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode,
          path: entry,
          serverTracked,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data?.partner) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.partner))
          }
        })
        .catch(() => null)
    } else {
      attributedEntryRef.current = null
    }
  }, [pathname, searchParams])

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

// Kept for existing callers. Partner clicks are recorded by /api/partners/attribute;
// confirmed signups and purchases are recorded by the server at those events.
// Browser interactions must not generate partner tracking requests.
export function trackPartnerEvent(_eventType: string, _metadata?: Record<string, any>) {
  return
}

