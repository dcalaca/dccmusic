'use client'

import { useEffect } from 'react'
import { pushGtmEvent } from '@/components/GtmEvents'

type TikTokEventName = 'ViewContent' | 'InitiateCheckout' | 'CompletePayment' | 'CompleteRegistration'

type TikTokProperties = {
  content_id: string
  content_name: string
  content_category?: string
  content_type?: string
  currency?: string
  value?: number
  price?: number
  quantity?: number
  event_id?: string
}

type TikTokIdentity = {
  email?: string | null
  phone_number?: string | null
  external_id?: string | null
}

async function sha256(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || !window.crypto?.subtle) return undefined

  const data = new TextEncoder().encode(normalized)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function identifyTikTokUser(identity: TikTokIdentity) {
  if (typeof window === 'undefined') return

  const ttq = (window as any).ttq
  if (typeof ttq?.identify !== 'function') return

  const [email, phoneNumber, externalId] = await Promise.all([
    sha256(identity.email),
    sha256(identity.phone_number),
    sha256(identity.external_id),
  ])

  const payload = {
    email,
    phone_number: phoneNumber,
    external_id: externalId,
  }

  if (!payload.email && !payload.phone_number && !payload.external_id) return
  ttq.identify(payload)
}

export async function identifyTikTokCurrentComposer() {
  if (typeof window === 'undefined') return

  const token = window.localStorage.getItem('composer_token')
  if (!token) return

  try {
    const response = await fetch('/api/compositores/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!response.ok) return

    const data = await response.json()
    await identifyTikTokUser({
      email: data?.composer?.email,
      external_id: data?.composer?.id,
    })
  } catch {
    // Identificação melhora o match do TikTok, mas não deve bloquear o evento.
  }
}

export function trackTikTokEvent(event: TikTokEventName, properties: TikTokProperties) {
  if (typeof window === 'undefined') return

  const contentType = properties.content_type || 'product'
  const quantity = properties.quantity || 1
  const price = properties.price ?? properties.value
  const gtmEventByTikTokEvent: Record<TikTokEventName, string> = {
    ViewContent: 'dcc_view_content',
    InitiateCheckout: 'dcc_initiate_checkout',
    CompletePayment: 'dcc_purchase',
    CompleteRegistration: 'dcc_complete_registration',
  }

  const payload = {
    content_id: properties.content_id,
    content_ids: [properties.content_id],
    content_name: properties.content_name,
    content_category: properties.content_category,
    content_type: contentType,
    contents: [
      {
        content_id: properties.content_id,
        content_type: contentType,
        content_name: properties.content_name,
        content_category: properties.content_category,
        price,
        quantity,
      },
    ],
    currency: properties.currency || 'BRL',
    value: properties.value,
  }

  pushGtmEvent(gtmEventByTikTokEvent[event], {
    product_id: properties.content_id,
    product_name: properties.content_name,
    product_category: properties.content_category || null,
    product_type: contentType,
    quantity,
    price,
    currency: properties.currency || 'BRL',
    value: properties.value,
    event_id: properties.event_id || null,
  })

  const ttq = (window as any).ttq
  if (typeof ttq?.track !== 'function') return

  ttq.track(event, payload, properties.event_id ? { event_id: properties.event_id } : undefined)
}

export function TikTokViewContent({
  contentId,
  contentName,
  value,
  currency = 'BRL',
}: {
  contentId: string
  contentName: string
  value?: number
  currency?: string
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      trackTikTokEvent('ViewContent', {
        content_id: contentId,
        content_name: contentName,
        currency,
        event_id: `view_content:${contentId}:${Date.now()}`,
        value,
      })
    }, 1200)

    return () => window.clearTimeout(timeout)
  }, [contentId, contentName, currency, value])

  return null
}
