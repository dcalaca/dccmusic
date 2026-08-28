'use client'

import { useState } from 'react'

const localeByCurrency: Record<string, string> = {
  BRL: 'pt-BR',
  PYG: 'es-PY',
  COP: 'es-CO',
  MXN: 'es-MX',
  EUR: 'pt-PT',
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(localeByCurrency[currency] || 'pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'PYG' || currency === 'COP' ? 0 : 2,
    maximumFractionDigits: currency === 'PYG' || currency === 'COP' ? 0 : 2,
  }).format(value)
}

function normalizeRaw(value: string, currency: string) {
  let normalized = value.replace(/[^0-9,.-]/g, '').replace(',', '.')
  const firstDot = normalized.indexOf('.')
  if (firstDot >= 0) {
    normalized = normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '')
  }
  if (currency === 'PYG' || currency === 'COP') normalized = normalized.replace(/\..*$/, '')
  return normalized
}

export default function CurrencyPriceInput({
  name = 'price',
  value,
  currency,
  compact = false,
}: {
  name?: string
  value: number
  currency: string
  compact?: boolean
}) {
  const initial = Number(value) || 0
  const [raw, setRaw] = useState(String(initial))
  const [display, setDisplay] = useState(formatCurrency(initial, currency))
  const [focused, setFocused] = useState(false)

  function handleFocus() {
    setFocused(true)
    setDisplay(raw)
  }

  function handleChange(next: string) {
    const normalized = normalizeRaw(next, currency)
    setRaw(normalized)
    setDisplay(normalized)
  }

  function handleBlur() {
    setFocused(false)
    const numeric = Number(raw)
    if (Number.isFinite(numeric)) {
      setRaw(String(numeric))
      setDisplay(formatCurrency(numeric, currency))
    }
  }

  return (
    <>
      <input type="hidden" name={name} value={raw} />
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={handleFocus}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        aria-label={`Preço em ${currency}`}
        className={compact
          ? 'w-44 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-bold text-white'
          : 'w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-xl font-black text-white'}
      />
    </>
  )
}
