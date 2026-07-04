import { STUDIO_MUSIC_CREDITS } from './studio'

export type StudioTopupQuote = {
  musicQuantity: number
  credits: number
  unitPrice: number
  totalPrice: number
  tierLabel: string
}

export const STUDIO_TOPUP_TIERS = [
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

export function getStudioTopupTiers() {
  return STUDIO_TOPUP_TIERS
}

export function getStudioTopupTier(musicQuantity: number) {
  const tiers = getStudioTopupTiers()
  return tiers.find((tier) => musicQuantity <= tier.maxMusicQuantity) || tiers[tiers.length - 1]
}

export function getStudioTopupQuote(inputQuantity: number): StudioTopupQuote {
  const musicQuantity = Math.max(1, Math.floor(Number(inputQuantity) || 0))
  const tier = getStudioTopupTier(musicQuantity)
  const totalPrice = Number((musicQuantity * tier.unitPrice).toFixed(2))

  return {
    musicQuantity,
    credits: musicQuantity * STUDIO_MUSIC_CREDITS,
    unitPrice: tier.unitPrice,
    totalPrice,
    tierLabel: tier.label,
  }
}
