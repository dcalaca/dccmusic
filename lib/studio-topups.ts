import { STUDIO_MUSIC_CREDITS } from './studio'
import type { DccCountry } from './localization'

export type StudioTopupCurrency = 'BRL' | 'EUR' | 'PYG' | 'COP' | 'MXN'

export type StudioTopupQuote = {
  musicQuantity: number
  credits: number
  unitPrice: number
  totalPrice: number
  tierLabel: string
  currency: StudioTopupCurrency
}

type StudioTopupTier = {
  maxMusicQuantity: number
  unitPrice: number
  label: string
}

export type StudioPlanPriceQuote = {
  amount: number
  currency: StudioTopupCurrency
}

export const STUDIO_TOPUP_TIERS: StudioTopupTier[] = [
  { maxMusicQuantity: 1, unitPrice: 2.99, label: 'Música avulsa' },
  { maxMusicQuantity: 8, unitPrice: 2.49, label: 'De 2 até 8 músicas' },
  { maxMusicQuantity: 13, unitPrice: 2.34, label: 'De 9 até 13 músicas' },
  { maxMusicQuantity: 29, unitPrice: 2.34, label: 'De 14 até 29 músicas' },
  { maxMusicQuantity: Infinity, unitPrice: 1.99, label: 'A partir de 30 músicas' },
]

const BRAZIL_BASE_PRICE = STUDIO_TOPUP_TIERS[0].unitPrice

// Preço avulso local definido para manter aproximadamente o mesmo peso
// do preço brasileiro (R$ 2,99) sobre o salário mínimo mensal de cada país.
const COUNTRY_BASE_PRICE: Record<DccCountry, { currency: StudioTopupCurrency; amount: number }> = {
  BR: { currency: 'BRL', amount: 2.99 },
  PY: { currency: 'PYG', amount: 5600 },
  CO: { currency: 'COP', amount: 3200 },
  PT: { currency: 'EUR', amount: 1.99 },
  MX: { currency: 'MXN', amount: 17.68 },
}

function roundLocalPrice(value: number, country: DccCountry) {
  if (country === 'PY' || country === 'CO') {
    return Math.round(value / 100) * 100
  }
  return Number(value.toFixed(2))
}

function buildCountryTiers(country: DccCountry): StudioTopupTier[] {
  const basePrice = COUNTRY_BASE_PRICE[country].amount
  return STUDIO_TOPUP_TIERS.map((tier) => ({
    ...tier,
    unitPrice: roundLocalPrice((tier.unitPrice / BRAZIL_BASE_PRICE) * basePrice, country),
  }))
}

export const STUDIO_TOPUP_TIERS_PT = buildCountryTiers('PT')
export const STUDIO_TOPUP_TIERS_PY = buildCountryTiers('PY')
export const STUDIO_TOPUP_TIERS_CO = buildCountryTiers('CO')
export const STUDIO_TOPUP_TIERS_MX = buildCountryTiers('MX')

export function getStudioTopupCurrency(country: DccCountry = 'BR'): StudioTopupCurrency {
  return COUNTRY_BASE_PRICE[country].currency
}

export function getStudioTopupTiers(country: DccCountry = 'BR') {
  if (country === 'PT') return STUDIO_TOPUP_TIERS_PT
  if (country === 'PY') return STUDIO_TOPUP_TIERS_PY
  if (country === 'CO') return STUDIO_TOPUP_TIERS_CO
  if (country === 'MX') return STUDIO_TOPUP_TIERS_MX
  return STUDIO_TOPUP_TIERS
}

export function getStudioTopupTier(musicQuantity: number, country: DccCountry = 'BR') {
  const tiers = getStudioTopupTiers(country)
  return tiers.find((tier) => musicQuantity <= tier.maxMusicQuantity) || tiers[tiers.length - 1]
}

export function getStudioTopupQuote(inputQuantity: number, country: DccCountry = 'BR'): StudioTopupQuote {
  const musicQuantity = Math.max(1, Math.floor(Number(inputQuantity) || 0))
  const tier = getStudioTopupTier(musicQuantity, country)
  const totalPrice = roundLocalPrice(musicQuantity * tier.unitPrice, country)

  return {
    musicQuantity,
    credits: musicQuantity * STUDIO_MUSIC_CREDITS,
    unitPrice: tier.unitPrice,
    totalPrice,
    tierLabel: tier.label,
    currency: getStudioTopupCurrency(country),
  }
}

// Planos Studio IA seguem a mesma proporção de preço do Brasil nos países
// solicitados. Portugal permanece com a regra atual dos planos; somente a
// recarga avulsa de Portugal usa preço nativo em EUR.
export function getStudioPlanPriceQuote(priceInBrl: number, country: DccCountry = 'BR'): StudioPlanPriceQuote {
  const amountBrl = Math.max(0, Number(priceInBrl) || 0)
  if (country !== 'PY' && country !== 'CO' && country !== 'MX') {
    return { amount: Number(amountBrl.toFixed(2)), currency: 'BRL' }
  }

  const localBase = COUNTRY_BASE_PRICE[country]
  return {
    amount: roundLocalPrice(amountBrl * (localBase.amount / BRAZIL_BASE_PRICE), country),
    currency: localBase.currency,
  }
}

export function getStripeMinorUnitAmount(amount: number, currency: StudioTopupCurrency) {
  // PYG é moeda zero-decimal na Stripe.
  return currency === 'PYG' ? Math.round(amount) : Math.round(amount * 100)
}
