'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'dcc_partner_attribution'
const MARKETING_ATTRIBUTION_COOKIE = 'dcc_marketing_attribution'
const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
const OPENAI_ADS_PIXEL_ID = '7P9kR7YDnZBmFo76pXpiAq'

function clean(value: string | null, max = 240) {
  const normalized = String(value || '').trim()
  return normalized ? normalized.slice(0, max) : null
}

function normalizeSource(value: string | null) {
  const source = String(value || '').trim().toLowerCase()
  if (!source) return null
  if (['chatgpt', 'openai', 'chatgpt_ads', 'openai_ads'].includes(source)) return 'openai'
  if (['facebook', 'instagram', 'fb', 'meta'].includes(source)) return 'meta'
  if (source.includes('tiktok')) return 'tiktok'
  if (source.includes('google')) return 'google'
  return source.slice(0, 120)
}

function readAttributionCookie() {
  try {
    const prefix = MARKETING_ATTRIBUTION_COOKIE + '='
    const raw = document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix))
    if (!raw) return null
    return JSON.parse(decodeURIComponent(raw.slice(prefix.length)))
  } catch {
    return null
  }
}

function writeAttributionCookie(value: any) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie =
      MARKETING_ATTRIBUTION_COOKIE +
      '=' +
      encodeURIComponent(JSON.stringify(value)) +
      '; Path=/; Max-Age=' +
      ATTRIBUTION_MAX_AGE_SECONDS +
      '; SameSite=Lax' +
      secure
  } catch {
    // Attribution must never block navigation or checkout.
  }
}

function syncAttributionWithServer(attribution: any) {
  try {
    const token = localStorage.getItem('composer_token')
    if (!token || !attribution) return
    fetch('/api/marketing-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ attribution }),
    }).catch(() => null)
  } catch {
    // Attribution must never block the product.
  }
}

type ComposerJwtPayload = {
  composerId?: string
  email?: string
}

function readComposerJwtPayload(): ComposerJwtPayload | null {
  try {
    const token = localStorage.getItem('composer_token')
    if (!token) return null
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as ComposerJwtPayload
  } catch {
    return null
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function syncOpenAIAdsUserData() {
  try {
    const payload = readComposerJwtPayload()
    const externalId = String(payload?.composerId || '').trim()
    if (!externalId || typeof crypto?.subtle?.digest !== 'function') return

    const externalIdHash = await sha256Hex(externalId)
    const dedupeKey = 'dcc_openai_user_init'
    if (sessionStorage.getItem(dedupeKey) === externalIdHash) return

    const email = String(payload?.email || '').trim().toLowerCase()
    const emailHash = email ? await sha256Hex(email) : null
    const country = String(document.documentElement.dataset.country || '').trim().toUpperCase()
    const oaiq = (window as any).oaiq
    if (typeof oaiq !== 'function') return

    oaiq('init', {
      pixelId: OPENAI_ADS_PIXEL_ID,
      user: {
        external_id_sha256: externalIdHash,
        ...(emailHash ? { email_sha256: emailHash } : {}),
        ...(country.length === 2 ? { country } : {}),
      },
    })

    sessionStorage.setItem(dedupeKey, externalIdHash)
  } catch {
    // Ads matching must never block navigation or authentication.
  }
}

function getExternalReferrer() {
  try {
    if (!document.referrer) return null
    const referrer = new URL(document.referrer)
    if (referrer.hostname === window.location.hostname) return null
    return referrer.hostname.slice(0, 300)
  } catch {
    return null
  }
}

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

  useEffect(() => {
    void syncOpenAIAdsUserData()
  }, [pathname])

  useEffect(() => {
    const utmSource = clean(searchParams.get('utm_source'), 120)
    const utmMedium = clean(searchParams.get('utm_medium'), 120)
    const utmCampaign = clean(searchParams.get('utm_campaign'))
    const utmContent = clean(searchParams.get('utm_content'))
    const utmTerm = clean(searchParams.get('utm_term'))
    const partnerCode = clean(searchParams.get('partner'), 120)

    const clickIds: Record<string, string> = {}
    for (const key of ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid']) {
      const value = clean(searchParams.get(key), 500)
      if (value) clickIds[key] = value
    }

    let source = normalizeSource(utmSource)
    let medium = utmMedium
    if (!source && (clickIds.gclid || clickIds.gbraid || clickIds.wbraid)) {
      source = 'google'
      medium = medium || 'cpc'
    } else if (!source && clickIds.fbclid) {
      source = 'meta'
      medium = medium || 'paid_social'
    } else if (!source && clickIds.ttclid) {
      source = 'tiktok'
      medium = medium || 'paid_social'
    } else if (!source && clickIds.msclkid) {
      source = 'bing'
      medium = medium || 'cpc'
    } else if (!source && partnerCode) {
      source = 'affiliate'
      medium = medium || 'affiliate'
    }

    const externalReferrer = getExternalReferrer()
    const hasExplicitMarketing =
      Boolean(utmSource || utmMedium || utmCampaign || utmContent || utmTerm || partnerCode) ||
      Object.keys(clickIds).length > 0

    if (!source && externalReferrer) {
      source = externalReferrer
      medium = 'referral'
    }

    const existing = readAttributionCookie()
    if (!hasExplicitMarketing && !externalReferrer && existing?.first_touch) {
      syncAttributionWithServer(existing)
      return
    }

    if (!source) {
      source = 'direct'
      medium = '(none)'
    }

    const touch = {
      source,
      medium: medium || null,
      campaign: utmCampaign || (partnerCode ? partnerCode : null),
      content: utmContent,
      term: utmTerm,
      partner_code: partnerCode,
      landing_path: window.location.pathname.slice(0, 500),
      referrer: externalReferrer,
      click_ids: Object.keys(clickIds).length ? clickIds : undefined,
      captured_at: new Date().toISOString(),
    }

    const attribution = {
      first_touch: existing?.first_touch || touch,
      last_touch: touch,
    }

    writeAttributionCookie(attribution)
    syncAttributionWithServer(attribution)
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
