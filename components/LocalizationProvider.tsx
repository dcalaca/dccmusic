'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  COUNTRY_CONFIG,
  COUNTRY_COOKIE,
  type DccCountry,
  type DccLocale,
  brlToPygDisplay,
  brlToCopDisplay,
  normalizeCountry,
} from '@/lib/localization'
import { translateToParaguayanSpanish } from '@/lib/i18n-es-py'

type LocalizationContextValue = {
  country: DccCountry
  locale: DccLocale
  currency: 'BRL' | 'PYG' | 'COP'
  paymentProvider: 'mercadopago' | 'stripe'
  setCountry: (country: DccCountry) => void
  formatMoney: (brlValue: number) => string
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null)

function translatePriceText(value: string, country: DccCountry) {
  return value.replace(/R\$\s*([\d.]+(?:,\d{1,2})?)/g, (_match, raw) => {
    const brl = Number(String(raw).replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(brl)) return _match
    const isColombia = country === 'CO'
    const formatted = new Intl.NumberFormat(isColombia ? 'es-CO' : 'es-PY', {
      style: 'currency',
      currency: isColombia ? 'COP' : 'PYG',
      maximumFractionDigits: 0,
    }).format(isColombia ? brlToCopDisplay(brl) : brlToPygDisplay(brl))
    return isColombia ? `COP ${formatted}` : formatted
  })
}

function translateDom(root: ParentNode, country: DccCountry) {
  const skipped = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT'])
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    if (parent && !skipped.has(parent.tagName) && !parent.closest('[data-no-translate]')) {
      const current = node.nodeValue || ''
      const next = translatePriceText(translateToParaguayanSpanish(current), country)
      if (next !== current) node.nodeValue = next
    }
    node = walker.nextNode()
  }

  root.querySelectorAll?.<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      const current = element.getAttribute(attribute)
      if (!current) continue
      const next = translatePriceText(translateToParaguayanSpanish(current), country)
      if (next !== current) element.setAttribute(attribute, next)
    }
  })
}

export default function LocalizationProvider({
  initialCountry,
  children,
}: {
  initialCountry: DccCountry
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [country, setCountryState] = useState<DccCountry>(normalizeCountry(initialCountry))
  const config = COUNTRY_CONFIG[country]

  const setCountry = useCallback((nextCountry: DccCountry) => {
    document.cookie = `${COUNTRY_COOKIE}=${nextCountry}; path=/; max-age=31536000; samesite=lax`
    localStorage.setItem(COUNTRY_COOKIE, nextCountry)
    setCountryState(nextCountry)
    window.location.reload()
  }, [])

  useEffect(() => {
    document.documentElement.lang = config.locale
    document.documentElement.dataset.country = country
    // O painel operacional interno continua em português. O Studio do compositor
    // faz parte do produto e, portanto, também recebe a localização paraguaia.
    if (country === 'BR' || pathname.startsWith('/admin')) return

    translateDom(document.body, country)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
            translateDom(node.parentNode as ParentNode, country)
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateDom(node as ParentNode, country)
          }
        })
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [config.locale, country, pathname])

  const formatMoney = useCallback((brlValue: number) => {
    if (country === 'PY') {
      return new Intl.NumberFormat('es-PY', {
        style: 'currency',
        currency: 'PYG',
        maximumFractionDigits: 0,
      }).format(brlToPygDisplay(brlValue))
    }
    if (country === 'CO') {
      const formatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(brlToCopDisplay(brlValue))
      return `COP ${formatted}`
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(brlValue)
  }, [country])

  const value = useMemo<LocalizationContextValue>(() => ({
    country,
    locale: config.locale,
    currency: config.currency,
    paymentProvider: config.paymentProvider,
    setCountry,
    formatMoney,
  }), [config, country, formatMoney, setCountry])

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization() {
  const context = useContext(LocalizationContext)
  if (!context) throw new Error('useLocalization precisa estar dentro de LocalizationProvider')
  return context
}
