'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiChevronDown, FiGlobe } from 'react-icons/fi'
import { localeLabels, supportedLocales } from '@/i18n/config'
import { useLocalization } from './LocalizationProvider'

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocalization()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={root} className="relative shrink-0" data-no-translate>
      <button
        ref={trigger}
        type="button"
        aria-label={`${t('global.language.choose')}: ${localeLabels[locale]}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-700 bg-gray-950 text-xs font-semibold leading-none text-gray-200 transition hover:border-primary-500 hover:text-white ${compact ? 'px-2' : 'px-2.5'}`}
      >
        <FiGlobe className="h-3.5 w-3.5 text-primary-300" aria-hidden />
        <span>{locale.toUpperCase()}</span>
        <FiChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[80] mt-2 w-56 rounded-xl border border-gray-700 bg-gray-950 p-1.5 shadow-2xl">
          <p className="px-3 py-2 text-xs font-semibold text-gray-400">{t('global.language.choose')}</p>
          {supportedLocales.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={locale === item}
              onClick={() => { setOpen(false); setLocale(item) }}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${locale === item ? 'bg-primary-600 text-white' : 'text-gray-200 hover:bg-gray-800'}`}
            >
              {localeLabels[item]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
