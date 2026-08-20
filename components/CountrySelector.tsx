'use client'

import { useState } from 'react'
import { FiChevronDown, FiGlobe } from 'react-icons/fi'
import { COUNTRY_CONFIG, type DccCountry } from '@/lib/localization'
import { useLocalization } from '@/components/LocalizationProvider'

export default function CountrySelector() {
  const { country, setCountry } = useLocalization()
  const [open, setOpen] = useState(false)
  const current = COUNTRY_CONFIG[country]

  return (
    <div className="relative" data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm font-semibold text-gray-200 transition hover:border-primary-500 hover:text-white"
        aria-label={country === 'BR' ? 'Mudar país' : 'Cambiar país'}
      >
        <FiGlobe className="h-4 w-4 text-primary-300" />
        <span>{current.flag}</span>
        <span className="hidden lg:inline">{current.label}</span>
        <FiChevronDown className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[80] w-52 overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 p-2 shadow-2xl shadow-black/70">
          {(Object.keys(COUNTRY_CONFIG) as DccCountry[]).map((code) => {
            const item = COUNTRY_CONFIG[code]
            return (
              <button
                key={code}
                type="button"
                onClick={() => setCountry(code)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  country === code ? 'bg-primary-600 text-white' : 'text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{item.flag}</span>
                <span>
                  <strong className="block">{item.label}</strong>
                  <span className="text-xs opacity-70">
                    {code === 'BR' ? 'Português · BRL' : code === 'PY' ? 'Español · PYG' : 'Español · COP'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
