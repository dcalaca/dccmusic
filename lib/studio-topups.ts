import { STUDIO_MUSIC_CREDITS } from './studio'
import type { DccCountry } from './localization'

export type StudioTopupCurrency = 'BRL' | 'EUR'

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

export const STUDIO_TOPUP_TIERS: StudioTopupTier[] = [
  {
    maxMusicQuantity: 1,
    unitPrice: 2.99,
    label: 'Música avulsa',
  },
  {
    maxMusicQuantity: 8,
    unitPrice: 2.49,
    label: 'De 2 até 8 músicas',
  },
  {
    maxMusicQuantity: 13,
    unitPrice: 2.34,
    label: 'De 9 até 13 músicas',
  },
  {
    maxMusicQuantity: 29,
    unitPrice: 2.34,
    label: 'De 14 até 29 músicas',
  },
  {
    maxMusicQuantity: Infinity,
    unitPrice: 1.99,
    label: 'A partir de 30 músicas',
  },
]

const PORTUGAL_BASE_PRICE = 1.99
const BRAZIL_BASE_PRICE = STUDIO_TOPUP_TIERS[0].unitPrice

// Portugal usa a mesma curva percentual de desconto do Brasil,
// mas com preço inicial próprio de €1,99 por música.
export const STUDIO_TOPUP_TIERS_PT: StudioTopupTier[] = STUDIO_TOPUP_TIERS.map((tier) => ({
  ...tier,
  unitPrice: Number(((tier.unitPrice / BRAZIL_BASE_PRICE) * PORTUGAL_BASE_PRICE).toFixed(2)),
}))

export function getStudioTopupCurrency(country: DccCountry = 'BR'): StudioTopupCurrency {
  return country === 'PT' ? 'EUR' : 'BRL'
}

export function getStudioTopupTiers(country: DccCountry = 'BR') {
  return country === 'PT' ? STUDIO_TOPUP_TIERS_PT : STUDIO_TOPUP_TIERS
}

export function getStudioTopupTier(musicQuantity: number, country: DccCountry = 'BR') {
  const tiers = getStudioTopupTiers(country)
  return tiers.find((tier) => musicQuantity <= tier.maxMusicQuantity) || tiers[tiers.length - 1]
}

export function getStudioTopupQuote(inputQuantity: number, country: DccCountry = 'BR'): StudioTopupQuote {
  const musicQuantity = Math.max(1, Math.floor(Number(inputQuantity) || 0))
  const tier = getStudioTopupTier(musicQuantity, country)
  const totalPrice = Number((musicQuantity * tier.unitPrice).toFixed(2))

  return {
    musicQuantity,
    credits: musicQuantity * STUDIO_MUSIC_CREDITS,
    unitPrice: tier.unitPrice,
    totalPrice,
    tierLabel: tier.label,
    currency: getStudioTopupCurrency(country),
  }
}
