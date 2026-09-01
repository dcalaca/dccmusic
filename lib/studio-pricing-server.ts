import 'server-only'

import type { DccCountry } from './localization'
import { supabaseAdmin } from './supabase'
import {
  getStudioPlanPriceQuote,
  getStudioTopupQuote,
  getStudioTopupTiers,
  type StudioTopupCurrency,
  type StudioTopupQuote,
} from './studio-topups'

type StudioTopupTierRow = {
  min_quantity: number
  max_quantity: number | null
  unit_price: number | string
  label: string
  currency: StudioTopupCurrency
}

export type StudioTopupTier = {
  minMusicQuantity: number
  maxMusicQuantity: number
  unitPrice: number
  label: string
}

export type StudioPricingSource = 'supabase' | 'fallback'

export type StudioPlanPriceQuote = {
  amount: number
  currency: StudioTopupCurrency
  source: StudioPricingSource
}

type StudioPlanPriceRow = {
  plan_slug: string
  price: number | string
  currency: StudioTopupCurrency
}

export async function getStudioTopupTiersFromPricing(country: DccCountry): Promise<{
  tiers: StudioTopupTier[]
  currency: StudioTopupCurrency
  source: StudioPricingSource
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('studio_topup_pricing')
      .select('min_quantity,max_quantity,unit_price,label,currency')
      .eq('country', country)
      .eq('is_active', true)
      .order('min_quantity', { ascending: true })

    if (error) throw error

    const rows = (data || []) as StudioTopupTierRow[]
    if (rows.length > 0) {
      const currency = rows[0].currency
      const tiers = rows
        .filter((row) => row.currency === currency)
        .map((row) => ({
          minMusicQuantity: Number(row.min_quantity),
          maxMusicQuantity: row.max_quantity == null ? Infinity : Number(row.max_quantity),
          unitPrice: Number(row.unit_price),
          label: row.label,
        }))
        .filter((tier) => Number.isFinite(tier.minMusicQuantity) && tier.unitPrice > 0)

      if (tiers.length > 0) return { tiers, currency, source: 'supabase' }
    }
  } catch (error) {
    console.error('[STUDIO PRICING] Falha ao ler recarga do Supabase; usando fallback:', error)
  }

  const fallbackQuote = getStudioTopupQuote(1, country)
  const fallbackTiers = getStudioTopupTiers(country).map((tier, index, all) => ({
    minMusicQuantity: index === 0 ? 1 : all[index - 1].maxMusicQuantity + 1,
    maxMusicQuantity: tier.maxMusicQuantity,
    unitPrice: tier.unitPrice,
    label: tier.label,
  }))

  return {
    tiers: fallbackTiers,
    currency: fallbackQuote.currency,
    source: 'fallback',
  }
}

export async function getStudioTopupQuoteFromPricing(
  inputQuantity: number,
  country: DccCountry
): Promise<StudioTopupQuote & { source: StudioPricingSource }> {
  const musicQuantity = Math.max(1, Math.floor(Number(inputQuantity) || 0))
  const pricing = await getStudioTopupTiersFromPricing(country)
  const tier = pricing.tiers.find((item) => musicQuantity >= item.minMusicQuantity && musicQuantity <= item.maxMusicQuantity)

  if (!tier) {
    return { ...getStudioTopupQuote(musicQuantity, country), source: 'fallback' }
  }

  const totalPrice = pricing.currency === 'PYG' || pricing.currency === 'COP'
    ? Math.round(musicQuantity * tier.unitPrice)
    : Number((musicQuantity * tier.unitPrice).toFixed(2))

  return {
    musicQuantity,
    credits: musicQuantity * 10,
    unitPrice: tier.unitPrice,
    totalPrice,
    tierLabel: tier.label,
    currency: pricing.currency,
    source: pricing.source,
  }
}

export async function getStudioPlanPriceFromPricing(
  planSlug: string,
  priceInBrl: number,
  country: DccCountry
): Promise<StudioPlanPriceQuote> {
  try {
    const { data, error } = await supabaseAdmin
      .from('studio_plan_country_pricing')
      .select('price,currency')
      .eq('plan_slug', planSlug)
      .eq('country', country)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (data && Number(data.price) > 0) {
      return {
        amount: Number(data.price),
        currency: data.currency as StudioTopupCurrency,
        source: 'supabase',
      }
    }
  } catch (error) {
    console.error('[STUDIO PRICING] Falha ao ler plano do Supabase; usando fallback:', error)
  }

  return { ...getStudioPlanPriceQuote(priceInBrl, country), source: 'fallback' }
}

/**
 * Busca os preços localizados de todos os planos em uma única ida ao Supabase.
 * A landing page usa esta versão para não criar uma requisição por card.
 */
export async function getStudioPlanPricesFromPricing(
  planSlugs: string[],
  country: DccCountry
): Promise<Record<string, StudioPlanPriceQuote>> {
  const uniqueSlugs = Array.from(new Set(planSlugs.filter(Boolean)))
  if (uniqueSlugs.length === 0) return {}

  try {
    const { data, error } = await supabaseAdmin
      .from('studio_plan_country_pricing')
      .select('plan_slug,price,currency')
      .eq('country', country)
      .eq('is_active', true)
      .in('plan_slug', uniqueSlugs)

    if (error) throw error

    return ((data || []) as StudioPlanPriceRow[]).reduce<Record<string, StudioPlanPriceQuote>>((prices, row) => {
      const amount = Number(row.price)
      if (row.plan_slug && amount > 0) {
        prices[row.plan_slug] = {
          amount,
          currency: row.currency,
          source: 'supabase',
        }
      }
      return prices
    }, {})
  } catch (error) {
    console.error('[STUDIO PRICING] Falha ao ler preços dos planos em lote; usando fallback:', error)
    return {}
  }
}
