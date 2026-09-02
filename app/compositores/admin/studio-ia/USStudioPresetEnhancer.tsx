'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const US_STYLES = [
  'Pop',
  'Hip-Hop / Rap',
  'R&B',
  'Country',
  'Rock',
  'Alternative / Indie',
  'EDM / Dance',
  'Gospel',
  'Jazz',
  'Blues',
  'Folk',
  'Soul',
  'Funk',
  'Metal',
  'Punk',
  'Latin Pop / Reggaeton',
  'Other / enter my style',
]

const BRAZIL_STYLE_MARKERS = ['Sertanejo', 'Pagode', 'Arrocha', 'Moda de Viola', 'Sertanejo Raiz']
const LANGUAGE_MARKERS = ['Português (Brasil)', 'Português (Portugal)', 'Español (México)']

function dispatchReactChange(select: HTMLSelectElement, value: string) {
  if (select.value === value) return
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function ensureOption(select: HTMLSelectElement, value: string) {
  if (Array.from(select.options).some((option) => option.value === value)) return
  select.add(new Option(value, value))
}

function enhanceStudioForm() {
  if (document.documentElement.dataset.country !== 'US') return

  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'))
  const styleSelect = selects.find((select) => {
    const values = Array.from(select.options).map((option) => option.value || option.textContent || '')
    return BRAZIL_STYLE_MARKERS.some((marker) => values.includes(marker))
  })

  if (styleSelect) {
    US_STYLES.forEach((style) => ensureOption(styleSelect, style))
    const current = styleSelect.value
    if (!styleSelect.dataset.usPresetApplied && BRAZIL_STYLE_MARKERS.includes(current)) {
      styleSelect.dataset.usPresetApplied = 'true'
      window.setTimeout(() => dispatchReactChange(styleSelect, 'Country'), 0)
    }
  }

  const languageSelect = selects.find((select) => {
    const values = Array.from(select.options).map((option) => option.value || option.textContent || '')
    return LANGUAGE_MARKERS.some((marker) => values.includes(marker))
  })

  if (languageSelect) {
    const english = 'English (United States)'
    ensureOption(languageSelect, english)
    if (!languageSelect.dataset.usPresetApplied) {
      languageSelect.dataset.usPresetApplied = 'true'
      window.setTimeout(() => dispatchReactChange(languageSelect, english), 0)
    }
  }
}

export default function USStudioPresetEnhancer() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname.includes('/studio-ia/novo')) return
    enhanceStudioForm()

    let scheduled = false
    const observer = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      window.requestAnimationFrame(() => {
        scheduled = false
        enhanceStudioForm()
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}
