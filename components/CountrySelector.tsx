'use client'

import { useState } from 'react'
import { FiChevronDown, FiGlobe } from 'react-icons/fi'
import { COUNTRY_CONFIG, type DccCountry } from '@/lib/localization'
import { useLocalization } from '@/components/LocalizationProvider'

function selectorLanguage(country: DccCountry) {
  const code = String(country)
  if (code === 'PY' || code === 'CO' || code === 'MX') return 'Español'
  if (code === 'US') return 'English'
  return 'Português'
}

function selectorCurrency(country: DccCountry) { return COUNTRY_CONFIG[String(country)].currency }

export default function CountrySelector({ compact = false }: { compact?: boolean }) {
  const { country, setCountry } = useLocalization()
  const [open, setOpen] = useState(false)
  const code = String(country)
  const current = COUNTRY_CONFIG[code]
  const isSpanish = code === 'PY' || code === 'CO' || code === 'MX'
  const isEnglish = code === 'US'
  const changeCountryLabel = isEnglish ? 'Change country' : isSpanish ? 'Cambiar país' : 'Mudar país'
  const countryPrefix = isEnglish ? 'Country:' : 'País:'
  const chooseCountryLabel = isEnglish ? 'Choose your country' : isSpanish ? 'Elige tu país' : 'Escolha o seu país'

  return <div className="relative" data-no-translate><button type="button" onClick={() => setOpen((value) => !value)} className={compact ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-700 bg-gray-950 text-sm font-semibold text-gray-200 transition hover:border-primary-500 hover:text-white' : 'inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-950 px-2.5 text-sm font-semibold text-gray-200 transition hover:border-primary-500 hover:text-white sm:gap-2 sm:px-3'} aria-label={changeCountryLabel} aria-expanded={open} aria-haspopup="menu">{compact ? null : <FiGlobe className="h-4 w-4 text-primary-300" />}{compact ? null : <span className="text-xs font-medium text-gray-400">{countryPrefix}</span>}<span>{current.flag}</span>{compact ? null : <span>{current.label}</span>}{compact ? null : <FiChevronDown className="h-3.5 w-3.5" />}</button>{open ? <div role="menu" className="absolute right-0 top-12 z-[80] w-56 overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 p-2 shadow-2xl shadow-black/70"><p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">{chooseCountryLabel}</p>{Object.keys(COUNTRY_CONFIG).map((rawCode) => { const item = COUNTRY_CONFIG[rawCode]; const typedCode = rawCode as DccCountry; return <button key={rawCode} type="button" role="menuitemradio" aria-checked={code === rawCode} onClick={() => { setCountry(typedCode); setOpen(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${code === rawCode ? 'bg-primary-600 text-white' : 'text-gray-200 hover:bg-gray-800'}`}><span className="text-xl">{item.flag}</span><span><strong className="block">{item.label}</strong><span className="text-xs opacity-70">{selectorLanguage(typedCode)} · {selectorCurrency(typedCode)}</span></span></button>})}</div> : null}</div>
}
