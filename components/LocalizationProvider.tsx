'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  COUNTRY_CONFIG,
  COUNTRY_COOKIE,
  type DccCountry,
  type DccLocale,
  formatLocalizedMoney,
  normalizeCountry,
} from '@/lib/localization'
import { translateToParaguayanSpanish } from '@/lib/i18n-es-py'
import { translateToMexicanSpanish } from '@/lib/i18n-es-mx'
import { translateToEuropeanPortuguese } from '@/lib/i18n-pt-pt'

type LocalizationContextValue = {
  country: DccCountry
  locale: DccLocale
  currency: 'BRL' | 'PYG' | 'COP' | 'EUR' | 'MXN'
  paymentProvider: 'mercadopago' | 'stripe'
  setCountry: (country: DccCountry) => void
  formatMoney: (brlValue: number) => string
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null)
const translatedTextValues = new WeakMap<Node, string>()
const translatedAttributeValues = new WeakMap<Element, Map<string, string>>()

function translateCopy(value: string, country: DccCountry) {
  if (country === 'PT') return translateToEuropeanPortuguese(value)
  if (country === 'MX') return translateToMexicanSpanish(value)
  if (country === 'PY' || country === 'CO') return translateToParaguayanSpanish(value)
  return value
}

function translatePriceText(value: string, country: DccCountry) {
  if (country === 'BR') return value
  return value.replace(/R\$\s*([\d.]+(?:,\d{1,2})?)/g, (_match, raw) => {
    const brl = Number(String(raw).replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(brl)) return _match
    const formatted = formatLocalizedMoney(brl, country)
    return country === 'CO' ? `COP ${formatted}` : formatted
  })
}

function translateMexicanPriceTextNode(node: Node, value: string) {
  const pattern = /R\$\s*([\d.]+(?:,\d{1,2})?)/g
  let lastIndex = 0
  let replaced = false
  const fragment = document.createDocumentFragment()
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    const brl = Number(String(match[1]).replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(brl)) continue

    const before = value.slice(lastIndex, match.index)
    if (before) fragment.appendChild(document.createTextNode(before))

    fragment.appendChild(document.createTextNode(formatLocalizedMoney(brl, 'MX')))

    const suffix = document.createElement('span')
    suffix.textContent = ' MXN'
    suffix.setAttribute('data-no-translate', 'true')
    suffix.style.fontSize = '0.44em'
    suffix.style.fontWeight = '700'
    suffix.style.opacity = '0.72'
    suffix.style.verticalAlign = '0.22em'
    suffix.style.whiteSpace = 'nowrap'
    fragment.appendChild(suffix)

    lastIndex = pattern.lastIndex
    replaced = true
  }

  if (!replaced) return false

  const after = value.slice(lastIndex)
  if (after) fragment.appendChild(document.createTextNode(after))
  node.replaceWith(fragment)
  return true
}

const translatableAttributes = ['placeholder', 'title', 'aria-label'] as const
const skippedTranslationTags = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA'])

function translateTextNode(node: Node, country: DccCountry) {
  if (node.nodeType !== Node.TEXT_NODE) return

  const parent = node.parentElement
  if (
    !parent ||
    skippedTranslationTags.has(parent.tagName) ||
    parent.closest('[data-no-translate], [translate="no"], [contenteditable="true"]')
  ) {
    return
  }

  const current = node.nodeValue || ''
  if (translatedTextValues.get(node) === current) return

  const localizedCopy = translateCopy(current, country)
  if (country === 'MX' && translateMexicanPriceTextNode(node, localizedCopy)) return

  const next = translatePriceText(localizedCopy, country)
  translatedTextValues.set(node, next)
  if (next !== current) node.nodeValue = next
}

function translateElementAttributes(element: Element, country: DccCountry) {
  if (element.closest('[data-no-translate], [translate="no"]')) return

  let translatedValues = translatedAttributeValues.get(element)
  if (!translatedValues) {
    translatedValues = new Map<string, string>()
    translatedAttributeValues.set(element, translatedValues)
  }

  for (const attribute of translatableAttributes) {
    const current = element.getAttribute(attribute)
    if (!current || translatedValues.get(attribute) === current) continue

    const next = translatePriceText(translateCopy(current, country), country)
    translatedValues.set(attribute, next)
    if (next !== current) element.setAttribute(attribute, next)
  }
}

function translateDom(root: ParentNode, country: DccCountry) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Node[] = []
  let node = walker.nextNode()
  while (node) {
    textNodes.push(node)
    node = walker.nextNode()
  }
  textNodes.forEach((textNode) => translateTextNode(textNode, country))

  if (root instanceof Element) translateElementAttributes(root, country)
  root.querySelectorAll?.<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
    translateElementAttributes(element, country)
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
    // O painel operacional interno permanece em português do Brasil.
    // Todo o produto público e a área do compositor recebem a localização selecionada.
    if (country === 'BR' || pathname.startsWith('/admin')) return

    document.title = translateCopy(document.title, country)
    translateDom(document.body, country)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, country)
          continue
        }

        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target as Element, country)
          continue
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node, country)
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateDom(node as ParentNode, country)
          }
        })
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatableAttributes],
    })
    return () => observer.disconnect()
  }, [config.locale, country, pathname])

  const formatMoney = useCallback((brlValue: number) => formatLocalizedMoney(brlValue, country), [country])

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
