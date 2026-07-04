'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getStoredPartnerAttribution } from '@/components/PartnerAttribution'

type GtmEventPayload = Record<string, string | number | boolean | null | undefined>

function getComposerContext() {
  if (typeof window === 'undefined') return {}

  try {
    const composerData = JSON.parse(window.localStorage.getItem('composer_data') || 'null')
    return {
      user_status: window.localStorage.getItem('composer_token') ? 'logged_in' : 'guest',
      user_type: composerData?.id ? 'composer' : 'visitor',
      composer_id: composerData?.id || null,
      composer_slug: composerData?.slug || null,
    }
  } catch {
    return {
      user_status: window.localStorage.getItem('composer_token') ? 'logged_in' : 'guest',
      user_type: 'visitor',
    }
  }
}

function getPartnerContext() {
  if (typeof window === 'undefined') return {}

  const urlPartner = new URLSearchParams(window.location.search).get('partner')
  const storedPartner = getStoredPartnerAttribution()

  return {
    partner_code: urlPartner || storedPartner?.code || null,
    partner_source: urlPartner ? 'url' : storedPartner?.code ? 'stored' : null,
  }
}

export function pushGtmEvent(event: string, payload: GtmEventPayload = {}) {
  if (typeof window === 'undefined') return

  const dataLayer = ((window as any).dataLayer = (window as any).dataLayer || [])

  dataLayer.push({
    event,
    event_source: 'dccmusic',
    page_path: window.location.pathname,
    page_url: window.location.href,
    page_title: document.title,
    currency: 'BRL',
    ...getComposerContext(),
    ...getPartnerContext(),
    ...payload,
  })
}

export default function GtmPageEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      pushGtmEvent('dcc_page_view', {
        page_search: window.location.search || null,
      })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [pathname, searchParams])

  return null
}
