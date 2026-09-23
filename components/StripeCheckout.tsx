'use client'

import { useEffect, useRef, useState } from 'react'
import { FiInfo, FiLoader, FiX } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

const STRIPE_SCRIPT = 'https://js.stripe.com/v3/'
let stripeScriptPromise: Promise<void> | null = null

function loadStripeScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe unavailable'))
  if ((window as any).Stripe) return Promise.resolve()
  if (stripeScriptPromise) return stripeScriptPromise
  stripeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${STRIPE_SCRIPT}"]`) as HTMLScriptElement | null
    const script = existing || document.createElement('script')
    script.src = STRIPE_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Stripe could not be loaded'))
    if (!existing) document.head.appendChild(script)
  })
  return stripeScriptPromise
}

export function StripePaymentOverlay({
  clientSecret,
  publishableKey,
  onClose,
  onComplete,
}: {
  clientSecret: string
  publishableKey: string
  onClose: () => void
  onComplete: () => void | Promise<void>
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef<any>(null)
  const onCompleteRef = useRef(onComplete)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const copy = {
    title: t('payment.stripe.title'),
    loading: t('payment.stripe.loading'),
    declineTitle: t('payment.stripe.declineTitle'),
    declineText: t('payment.stripe.declineText'),
    close: t('common.actions.close'),
  }

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadStripeScript()
        if (cancelled || !containerRef.current) return
        const stripe = (window as any).Stripe(publishableKey)
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret, onComplete: () => onCompleteRef.current() })
        if (cancelled) return checkout.destroy()
        checkoutRef.current = checkout
        checkout.mount(containerRef.current)
        setReady(true)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || t('payment.stripe.openError'))
      }
    })()
    return () => {
      cancelled = true
      checkoutRef.current?.destroy?.()
      checkoutRef.current = null
    }
  }, [clientSecret, publishableKey, t])

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/80 sm:items-center sm:p-4">
      <div className="relative max-h-[96vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-gray-700 bg-gray-900 p-4 shadow-2xl sm:rounded-2xl sm:p-6">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 text-gray-400 hover:text-white" title={copy.close}>
          <FiX className="h-5 w-5" />
        </button>
        <h2 className="mb-4 pr-8 text-xl font-black text-white">{copy.title}</h2>
        {!error && !ready ? <div className="mb-3 flex items-center gap-2 text-sm text-gray-400"><FiLoader className="animate-spin" /> {copy.loading}</div> : null}
        <div ref={containerRef} />
        {error ? <p className="rounded-xl border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
        {!error ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-gray-700 bg-black/30 p-3 text-sm text-gray-300">
            <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
            <p>
              <strong className="block text-gray-100">{copy.declineTitle}</strong>
              {copy.declineText}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
