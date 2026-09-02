'use client'

import { useLocalization } from '@/components/LocalizationProvider'
import { getStudioPlanPriceQuote, getStudioTopupTiers, type StudioTopupCurrency } from '@/lib/studio-topups'

function formatCurrency(value: number, currency: StudioTopupCurrency) {
  const config: Record<StudioTopupCurrency, { locale: string; maximumFractionDigits: number }> = {
    BRL: { locale: 'pt-BR', maximumFractionDigits: 2 },
    PYG: { locale: 'es-PY', maximumFractionDigits: 0 },
    COP: { locale: 'es-CO', maximumFractionDigits: 0 },
    EUR: { locale: 'pt-PT', maximumFractionDigits: 2 },
    MXN: { locale: 'es-MX', maximumFractionDigits: 2 },
    USD: { locale: 'en-US', maximumFractionDigits: 2 },
  }
  const selected = config[currency]
  return new Intl.NumberFormat(selected.locale, { style: 'currency', currency, maximumFractionDigits: selected.maximumFractionDigits }).format(value)
}

export function StudioTopupPricingGrid() {
  const { country } = useLocalization()
  const code = String(country)
  const tiers = getStudioTopupTiers(country)
  const currency: StudioTopupCurrency = code === 'PY' ? 'PYG' : code === 'CO' ? 'COP' : code === 'MX' ? 'MXN' : code === 'PT' ? 'EUR' : code === 'US' ? 'USD' : 'BRL'
  const presentation = code === 'US'
    ? [['1 song', tiers[0].unitPrice], ['2 to 8 songs', tiers[1].unitPrice], ['9 to 29 songs', tiers[2].unitPrice], ['30+ songs', tiers[4].unitPrice]] as const
    : [['1 música', tiers[0].unitPrice], ['2 a 8 músicas', tiers[1].unitPrice], ['9 a 29 músicas', tiers[2].unitPrice], ['A partir de 30', tiers[4].unitPrice]] as const

  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4" data-no-translate>{presentation.map(([label, price]) => <div key={label} className="rounded-2xl border border-gray-800 bg-black/50 p-3 sm:p-5"><p className="text-xs text-gray-400 sm:text-sm">{label}</p><p className="mt-1 text-sm font-black text-white sm:mt-2 sm:text-xl">{formatCurrency(price, currency)} {code === 'US' ? 'per song' : 'por música'}</p></div>)}</div>
}

export function StudioPlanLocalizedPrice({ price, durationMonths }: { price: number; durationMonths: number }) {
  const { country } = useLocalization()
  const code = String(country)
  const quote = getStudioPlanPriceQuote(price, country)
  const period = code === 'US' ? (durationMonths === 1 ? 'month' : `${durationMonths} months`) : (durationMonths === 1 ? 'mês' : `${durationMonths} meses`)
  return <div className="mb-4" data-no-translate><span className="text-3xl font-black text-white">{formatCurrency(quote.amount, quote.currency)}</span><span className="text-gray-400">/{period}</span></div>
}
