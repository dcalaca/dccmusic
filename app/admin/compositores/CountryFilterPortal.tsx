'use client'

import { useEffect, useRef, useState } from 'react'
import { FiCheck, FiChevronDown, FiGlobe } from 'react-icons/fi'

const COUNTRY_OPTIONS = [
  { code: '', label: 'Todos os países' },
  { code: 'BR', label: 'Brasil' },
  { code: 'PY', label: 'Paraguai' },
  { code: 'CO', label: 'Colômbia' },
  { code: 'PT', label: 'Portugal' },
  { code: 'MX', label: 'México' },
  { code: 'US', label: 'Estados Unidos' },
]

const FLAG_SVGS: Record<string, string> = {
  BR: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="30" height="20" fill="#009B3A"/><path d="M15 2.4 27 10 15 17.6 3 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.8 9.2c2.8-.7 5.8-.2 8.4 1.4" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round"/></svg>',
  PY: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="30" height="6.67" y="0" fill="#D52B1E"/><rect width="30" height="6.66" y="6.67" fill="#fff"/><rect width="30" height="6.67" y="13.33" fill="#0038A8"/><circle cx="15" cy="10" r="2" fill="#F4C542"/><circle cx="15" cy="10" r="1.15" fill="#fff"/><circle cx="15" cy="10" r=".55" fill="#2E7D32"/></svg>',
  CO: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="30" height="10" fill="#FCD116"/><rect width="30" height="5" y="10" fill="#003893"/><rect width="30" height="5" y="15" fill="#CE1126"/></svg>',
  PT: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="12" height="20" fill="#046A38"/><rect x="12" width="18" height="20" fill="#DA291C"/><circle cx="12" cy="10" r="3.3" fill="#FFCC00"/><circle cx="12" cy="10" r="2.25" fill="#fff"/><path d="M10.7 8.6h2.6v3h-2.6z" fill="#DA291C"/><path d="M11.1 9h1.8v2.2h-1.8z" fill="#fff"/></svg>',
  MX: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE1126"/><circle cx="15" cy="10" r="2.2" fill="#8B5E3C"/><path d="M12.8 11.5c1.3 1.2 3.1 1.2 4.4 0" fill="none" stroke="#2E7D32" stroke-width=".75" stroke-linecap="round"/><path d="M14.2 8.6c.6-.9 1.5-1.2 2.2-.7-.4.4-.7.8-.9 1.4" fill="none" stroke="#2E7D32" stroke-width=".6" stroke-linecap="round"/></svg>',
  US: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><path d="M0 0h30v1.54H0zm0 3.08h30v1.54H0zm0 3.08h30V7.7H0zm0 3.08h30v1.54H0zm0 3.08h30v1.54H0zm0 3.08h30v1.54H0zm0 3.08h30V20H0z" fill="#B22234"/><rect width="12.5" height="10.78" fill="#3C3B6E"/><g fill="#fff"><circle cx="2" cy="2" r=".55"/><circle cx="5" cy="2" r=".55"/><circle cx="8" cy="2" r=".55"/><circle cx="11" cy="2" r=".55"/><circle cx="3.5" cy="4.7" r=".55"/><circle cx="6.5" cy="4.7" r=".55"/><circle cx="9.5" cy="4.7" r=".55"/><circle cx="2" cy="7.4" r=".55"/><circle cx="5" cy="7.4" r=".55"/><circle cx="8" cy="7.4" r=".55"/><circle cx="11" cy="7.4" r=".55"/></g></svg>',
}

function FlagIcon({ code, className = 'h-4 w-6' }: { code: string; className?: string }) {
  const svg = FLAG_SVGS[code]
  if (!svg) return null

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)] [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function replaceCountryTextWithFlag() {
  const tables = Array.from(document.querySelectorAll('table'))

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th'))
    const countryColumnIndex = headers.findIndex((header) => header.textContent?.trim().toLowerCase() === 'país')
    if (countryColumnIndex < 0) return

    Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'))
      const cell = cells[countryColumnIndex] as HTMLTableCellElement | undefined
      if (!cell || cell.querySelector('[data-country-flag]')) return

      const text = String(cell.textContent || '').trim()
      const option = COUNTRY_OPTIONS.find((item) => item.code && text.toLocaleLowerCase('pt-BR').includes(item.label.toLocaleLowerCase('pt-BR')))
      if (!option?.code || !FLAG_SVGS[option.code]) return

      const wrapper = document.createElement('span')
      wrapper.className = 'inline-flex items-center gap-2'
      wrapper.setAttribute('data-country-flag', option.code)

      const flag = document.createElement('span')
      flag.className = 'inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)] [&>svg]:h-full [&>svg]:w-full'
      flag.innerHTML = FLAG_SVGS[option.code]

      const label = document.createElement('span')
      label.textContent = option.label

      wrapper.append(flag, label)
      cell.replaceChildren(wrapper)
    })
  })
}

export default function CountryFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (country: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = COUNTRY_OPTIONS.find((option) => option.code === value) || COUNTRY_OPTIONS[0]

  useEffect(() => {
    if (window.location.pathname !== '/admin/compositores') return

    replaceCountryTextWithFlag()
    const observer = new MutationObserver(() => replaceCountryTextWithFlag())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectCountry = (country: string) => {
    setOpen(false)
    onChange(country)
  }

  return (
    <div ref={menuRef} className="relative min-w-[190px] shrink-0 text-sm">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar compositores por país"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex w-full items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-semibold text-gray-100 outline-none transition hover:border-primary-500"
      >
        {selectedOption.code ? (
          <FlagIcon code={selectedOption.code} />
        ) : (
          <FiGlobe className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <span className="flex-1 text-left">{selectedOption.label}</span>
        <FiChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-[80] mt-2 w-full min-w-[210px] overflow-hidden rounded-xl border border-gray-700 bg-gray-950 py-1 shadow-2xl shadow-black/60"
        >
          {COUNTRY_OPTIONS.map((option) => {
            const active = option.code === selectedOption.code
            return (
              <button
                key={option.code || 'all'}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectCountry(option.code)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${active ? 'bg-primary-700/40 text-white' : 'text-gray-200 hover:bg-gray-800'}`}
              >
                {option.code ? (
                  <FlagIcon code={option.code} />
                ) : (
                  <FiGlobe className="h-4 w-6 shrink-0 text-gray-400" />
                )}
                <span className="flex-1 font-semibold">{option.label}</span>
                {active && <FiCheck className="h-4 w-4 text-primary-300" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
