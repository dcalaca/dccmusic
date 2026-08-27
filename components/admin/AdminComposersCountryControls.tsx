'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'dcc_admin_composers_country_filter'
const FETCH_PATCH_FLAG = '__dccAdminCountryFetchPatched'

const countries = [
  { code: '', label: 'Todos os países' },
  { code: 'BR', label: '🇧🇷 Brasil' },
  { code: 'MX', label: '🇲🇽 México' },
  { code: 'CO', label: '🇨🇴 Colômbia' },
  { code: 'PY', label: '🇵🇾 Paraguai' },
  { code: 'PT', label: '🇵🇹 Portugal' },
]

function patchComposerListFetch() {
  if (typeof window === 'undefined') return
  const anyWindow = window as typeof window & { [FETCH_PATCH_FLAG]?: boolean }
  if (anyWindow[FETCH_PATCH_FLAG]) return

  const originalFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (rawUrl.includes('/api/admin/composers/list')) {
        const country = localStorage.getItem(STORAGE_KEY) || ''
        if (country) {
          const url = new URL(rawUrl, window.location.origin)
          url.searchParams.set('country', country)
          const nextUrl = rawUrl.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`

          if (typeof input === 'string' || input instanceof URL) {
            return originalFetch(nextUrl, init)
          }

          return originalFetch(new Request(nextUrl, input), init)
        }
      }
    } catch {
      // Se algo inesperado acontecer, mantém o fetch original.
    }

    return originalFetch(input, init)
  }) as typeof window.fetch

  anyWindow[FETCH_PATCH_FLAG] = true
}

function simplifyStatsCards() {
  const labels = new Set(['Letras IA', 'Músicas IA'])
  document.querySelectorAll('p').forEach((element) => {
    if (!labels.has((element.textContent || '').trim())) return
    const card = element.parentElement
    const grid = card?.parentElement
    if (card) card.style.display = 'none'
    if (grid) {
      grid.classList.remove('lg:grid-cols-6')
      grid.classList.add('lg:grid-cols-4')
    }
  })
}

function reloadComposerList() {
  const reloadButton = Array.from(document.querySelectorAll('button')).find(
    (button) => (button.textContent || '').trim() === 'Recarregar'
  ) as HTMLButtonElement | undefined

  reloadButton?.click()
}

export default function AdminComposersCountryControls() {
  const pathname = usePathname()
  const isComposerAdmin = pathname === '/admin/compositores'
  const [country, setCountry] = useState('')

  if (typeof window !== 'undefined' && isComposerAdmin) {
    patchComposerListFetch()
  }

  useEffect(() => {
    if (!isComposerAdmin) return

    setCountry(localStorage.getItem(STORAGE_KEY) || '')
    simplifyStatsCards()

    const observer = new MutationObserver(() => simplifyStatsCards())
    observer.observe(document.body, { childList: true, subtree: true })

    const savedCountry = localStorage.getItem(STORAGE_KEY) || ''
    if (savedCountry) {
      window.setTimeout(reloadComposerList, 150)
    }

    return () => observer.disconnect()
  }, [isComposerAdmin])

  if (!isComposerAdmin) return null

  return (
    <div className="mx-auto w-full max-w-[1536px] px-4 pt-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="admin-composer-country-filter" className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Filtrar por país
        </label>
        <select
          id="admin-composer-country-filter"
          value={country}
          onChange={(event) => {
            const nextCountry = event.target.value
            setCountry(nextCountry)
            if (nextCountry) localStorage.setItem(STORAGE_KEY, nextCountry)
            else localStorage.removeItem(STORAGE_KEY)
            window.setTimeout(reloadComposerList, 0)
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-primary-500"
        >
          {countries.map((item) => (
            <option key={item.code || 'all'} value={item.code}>{item.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
