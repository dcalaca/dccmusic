'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStoredPartnerAttribution } from './PartnerAttribution'
import { pushGtmEvent } from './GtmEvents'

export default function GoogleLoginButton({ redirectTo }: { redirectTo?: string | null }) {
  const { t, i18n } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<{ clientId: string; nonce: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/compositores/google', { cache: 'no-store' }).then(r => r.json()).then(data => {
      if (active && data.enabled) setConfig(data)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!config || !ready || !container.current) return
    const google = (window as any).google?.accounts?.id
    if (!google) return
    google.initialize({
      client_id: config.clientId,
      nonce: config.nonce,
      auto_select: false,
      callback: async ({ credential }: { credential: string }) => {
        setLoading(true)
        setError('')
        try {
          const response = await fetch('/api/compositores/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential, partnerAttribution: getStoredPartnerAttribution() }) })
          const data = await response.json()
          if (!response.ok) {
            setError(t(`auth.google.${['emailVerification', 'deletedAccount', 'unavailable'].includes(data.code) ? data.code : 'invalid'}`))
            const renewed = await fetch('/api/compositores/google', { cache: 'no-store' }).then(r => r.json())
            if (renewed.enabled) setConfig(renewed)
            return
          }
          localStorage.setItem('composer_token', data.token)
          localStorage.setItem('composer_data', JSON.stringify(data.composer))
          localStorage.removeItem('composer_token_temp')
          window.dispatchEvent(new Event('authChange'))
          if (data.created) pushGtmEvent('dcc_complete_registration', { product_id: 'composer_signup', product_name: 'Cadastro de compositor', product_type: 'registration', event_id: `composer_registration:${data.composer.id}`, value: 0.01, currency: 'BRL' })
          const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.includes('\\') ? redirectTo : '/compositores/admin/studio-ia'
          window.location.assign(target)
        } catch {
          setError(t('auth.google.invalid'))
        } finally {
          setLoading(false)
        }
      },
    })
    container.current.replaceChildren()
    google.renderButton(container.current, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: Math.min(320, container.current.clientWidth), locale: i18n.language })
  }, [config, ready, redirectTo, t, i18n.language])

  if (!config) return null
  return (
    <div className="mb-6">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError(t('auth.google.unavailable'))} />
      <div ref={container} className={loading ? 'pointer-events-none opacity-60 flex justify-center' : 'flex justify-center'} />
      {loading && <p className="mt-3 text-sm text-gray-400" role="status">{t('auth.google.loading')}</p>}
      {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
      <div className="mt-6 flex items-center gap-3 text-sm text-gray-400"><span className="h-px flex-1 bg-gray-700" />{t('auth.google.or')}<span className="h-px flex-1 bg-gray-700" /></div>
    </div>
  )
}
