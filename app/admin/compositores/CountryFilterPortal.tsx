'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiGlobe } from 'react-icons/fi'

const COUNTRY_OPTIONS = [
  { code: '', label: 'Todos os países' },
  { code: 'BR', label: '🇧🇷 Brasil' },
  { code: 'PY', label: '🇵🇾 Paraguai' },
  { code: 'CO', label: '🇨🇴 Colômbia' },
  { code: 'PT', label: '🇵🇹 Portugal' },
]

export default function CountryFilterPortal() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null)
  const selectedCountry = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return String(new URLSearchParams(window.location.search).get('country') || '').toUpperCase()
  }, [])

  useEffect(() => {
    let attempts = 0
    let anchor: HTMLDivElement | null = null

    const findFilterButton = () => {
      attempts += 1
      const buttons = Array.from(document.querySelectorAll('button'))
      const filterButton = buttons.find((button) => button.textContent?.trim() === 'Filtrar')

      if (filterButton?.parentElement) {
        anchor = document.createElement('div')
        anchor.dataset.countryFilterAnchor = 'true'
        anchor.className = 'shrink-0'
        filterButton.parentElement.insertBefore(anchor, filterButton)
        setMountNode(anchor)
        return true
      }

      return attempts >= 100
    }

    if (findFilterButton()) return

    const timer = window.setInterval(() => {
      if (findFilterButton()) window.clearInterval(timer)
    }, 50)

    return () => {
      window.clearInterval(timer)
      if (anchor?.parentElement) anchor.parentElement.removeChild(anchor)
    }
  }, [])

  if (!mountNode) return null

  return createPortal(
    <label className="inline-flex min-w-[190px] items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus-within:border-primary-500">
      <FiGlobe className="h-4 w-4 shrink-0 text-gray-400" />
      <select
        aria-label="Filtrar compositores por país"
        value={selectedCountry}
        onChange={(event) => {
          const url = new URL(window.location.href)
          const country = event.target.value

          if (country) url.searchParams.set('country', country)
          else url.searchParams.delete('country')

          window.location.href = url.toString()
        }}
        className="w-full cursor-pointer bg-transparent font-semibold text-gray-100 outline-none"
      >
        {COUNTRY_OPTIONS.map((option) => (
          <option key={option.code || 'all'} value={option.code} className="bg-gray-900 text-gray-100">
            {option.label}
          </option>
        ))}
      </select>
    </label>,
    mountNode
  )
}
