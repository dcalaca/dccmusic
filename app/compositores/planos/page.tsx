import type { Metadata } from 'next'
import * as db from '@/lib/db'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { FiCheck, FiCreditCard, FiZap } from 'react-icons/fi'
import { PlanPurchaseLink } from '@/components/PlanPurchaseLink'
import { COUNTRY_COOKIE, getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import { getStudioPlanPriceFromPricing, getStudioPlanPricesFromPricing, getStudioTopupTiersFromPricing } from '@/lib/studio-pricing-server'
import type { StudioTopupCurrency } from '@/lib/studio-topups'
import { createDccI18n } from '@/i18n/i18next'


export const metadata: Metadata = {
  title: 'DCC Music - Planos para Criar Músicas com IA',
  description: 'Crie sua primeira música grátis e conheça os planos do DCC Music para criar músicas com inteligência artificial.',
  alternates: {
    canonical: 'https://www.dccmusic.online/compositores/planos',
  },
  openGraph: {
    title: 'DCC Music - Crie sua primeira música grátis',
    description: 'Transforme sua ideia ou letra em uma música completa com inteligência artificial.',
    url: 'https://www.dccmusic.online/compositores/planos',
    siteName: 'DCC Music',
    type: 'website',
    images: [
      {
        url: 'https://www.dccmusic.online/Est%C3%BAdio%20de%20grava%C3%A7%C3%A3o%20com%20luzes%20neon-2560x1440.png',
        width: 2560,
        height: 1440,
        alt: 'DCC Music - Crie músicas com inteligência artificial',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DCC Music - Crie sua primeira música grátis',
    description: 'Transforme sua ideia ou letra em uma música completa com inteligência artificial.',
    images: ['https://www.dccmusic.online/Est%C3%BAdio%20de%20grava%C3%A7%C3%A3o%20com%20luzes%20neon-2560x1440.png'],
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isGoldPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return Boolean(plan.hasGoldBadge || plan.hasPriorityFeatured || identity.includes('ouro') || identity.includes('gold'))
}

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

function getPlanFeatures(plan: db.Plan) {
  const features = Array.isArray(plan.features) ? [...plan.features] : []
  if (isGoldPlan(plan) && !features.some((feature) => /gerador de capas ia/i.test(feature))) features.push('Gerador de Capas IA com 100 capas por mês')
  return features
}

function formatCurrency(value: number, currency: StudioTopupCurrency = 'BRL') {
  const config: Record<StudioTopupCurrency, { locale: string; maximumFractionDigits: number }> = {
    BRL: { locale: 'pt-BR', maximumFractionDigits: 2 },
    PYG: { locale: 'es-PY', maximumFractionDigits: 0 },
    COP: { locale: 'es-CO', maximumFractionDigits: 0 },
    EUR: { locale: 'pt-PT', maximumFractionDigits: 2 },
    MXN: { locale: 'es-MX', maximumFractionDigits: 2 },
    USD: { locale: 'en-US', maximumFractionDigits: 2 },
    GBP: { locale: 'en-GB', maximumFractionDigits: 2 },
  }
  const selected = config[currency]
  return new Intl.NumberFormat(selected.locale, { style: 'currency', currency, maximumFractionDigits: selected.maximumFractionDigits }).format(value)
}

function getStudioPlanTone(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  if (identity.includes('elite')) return 'border-yellow-400/70 bg-gradient-to-br from-yellow-950/40 via-purple-950/50 to-black shadow-yellow-950/20'
  if (identity.includes('pro')) return 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black shadow-purple-950/30'
  return 'border-purple-700/60 bg-gray-950/70'
}

export default async function PlansPage() {
  const allPlans = await db.getPlans()
  const studioPlans = allPlans.filter(isStudioPlan)
  const composerPlans = allPlans.filter((plan) => !isStudioPlan(plan))
  const requestHeaders = headers()
  const country = normalizeCountry(requestHeaders.get('x-dcc-country') || cookies().get(COUNTRY_COOKIE)?.value || requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry'))
  const isUS = String(country) === 'US' || String(country) === 'GB'
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const { t } = i18n
  const topupPricing = await getStudioTopupTiersFromPricing(country)
  const topupTiers = topupPricing.tiers
  const topupPresentation = [
    [t('payment.plans.topup.one'), topupTiers[0]],
    [t('payment.plans.topup.twoToEight'), topupTiers[1]],
    [t('payment.plans.topup.nineToTwentyNine'), topupTiers[2]],
    [t('payment.plans.topup.thirtyPlus'), topupTiers[4]],
  ] as const
  const studioPlansWithPrices = await Promise.all(studioPlans.map(async (plan) => ({ plan, priceQuote: await getStudioPlanPriceFromPricing(plan.slug, plan.price, country) })))
  const composerPriceRows = await getStudioPlanPricesFromPricing(composerPlans.map((plan) => plan.slug), country)
  const composerPlansWithPrices = await Promise.all(composerPlans.map(async (plan) => ({
    plan,
    priceQuote: composerPriceRows[plan.slug]
      || (isUS ? null : await getStudioPlanPriceFromPricing(plan.slug, plan.price, country)),
  })))

  return (
    <div className="min-h-screen py-6 sm:py-8"><div className="container mx-auto px-4 sm:px-6 lg:px-8"><div className="max-w-6xl mx-auto">
      <div className="mb-10 text-center sm:mb-12"><h1 className="mb-4 text-3xl font-bold sm:text-5xl"><span className="gradient-text">{t('payment.plans.title')}</span></h1><p className="mb-4 text-base text-gray-400 sm:text-lg">{t('payment.plans.subtitle')}</p><div className="bg-primary-900/30 border border-primary-800 rounded-lg p-4 max-w-3xl mx-auto"><p className="text-primary-300 text-sm"><strong>{t('payment.plans.tipLabel')}</strong> {t('payment.plans.tip')}</p></div></div>
      <section className="mb-10 sm:mb-12"><div className="mb-5 flex items-start gap-3"><FiCreditCard className="h-6 w-6 text-purple-300" /><div><p className="mb-1 text-sm font-bold uppercase tracking-wide text-purple-300">{t('payment.plans.topup.noMonthly')}</p><h2 className="text-xl font-black sm:text-2xl">{t('payment.plans.topup.title')}</h2><p className="text-sm text-gray-400">{t('payment.plans.topup.description')}</p></div></div><div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black p-5 sm:rounded-3xl sm:p-6"><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{topupPresentation.map(([label,tier]) => <div key={label} className="rounded-2xl border border-gray-800 bg-black/40 p-4"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 text-lg font-black text-white" data-no-translate>{formatCurrency(tier.unitPrice, topupPricing.currency)} {t('payment.plans.topup.perSong')}</p></div>)}</div><Link href="/compositores/admin/studio-ia/recarga" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/70 bg-purple-950/50 px-6 py-4 font-bold text-purple-100 hover:border-purple-300 md:w-auto"><FiCreditCard />{t('payment.plans.topup.buy')}</Link></div></div></section>
      <section className="mb-12 sm:mb-14"><div className="mb-5 flex items-start gap-3"><FiZap className="h-6 w-6 text-purple-300" /><div><h2 className="text-xl font-black sm:text-2xl">{t('payment.plans.studio.title')}</h2><p className="text-sm text-gray-400">{t('payment.plans.studio.description')}</p></div></div>{studioPlansWithPrices.length===0 ? <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-6 text-center text-gray-400">{t('payment.plans.studio.empty')}</div> : <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{studioPlansWithPrices.map(({plan,priceQuote})=>{const features=Array.isArray(plan.features)?plan.features:[];const identity=`${plan.name||''} ${plan.slug||''}`.toLowerCase();return <div key={plan.id} className={`relative flex h-full flex-col rounded-2xl border p-5 shadow-lg sm:rounded-3xl sm:p-8 ${getStudioPlanTone(plan)}`}>{identity.includes('pro')&&<div className="absolute right-5 top-5 rounded-full border border-purple-300/60 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-100">{t('payment.plans.studio.popular')}</div>}<h3 className="mb-2 text-2xl font-black">{plan.name}</h3><div className="mb-6" data-no-translate><span className="text-3xl font-black text-white sm:text-4xl">{formatCurrency(priceQuote.amount,priceQuote.currency)}</span><span className="text-gray-400">/{isUS?(plan.durationMonths===1?t('payment.plans.period.month'):t('payment.plans.period.months', { count: plan.durationMonths })):(plan.durationMonths===1?t('payment.plans.period.month'):t('payment.plans.period.months', { count: plan.durationMonths }))}</span></div>{plan.description&&<p className="mb-5 text-sm text-gray-400">{plan.description}</p>}{features.length>0&&<ul className="mb-8 flex-grow space-y-3">{features.map((feature)=><li key={feature} className="flex items-start gap-2 text-sm text-gray-300"><FiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-300" />{feature}</li>)}</ul>}<PlanPurchaseLink href={`/compositores/checkout?plan=${plan.slug}`} planType="studio" className="mt-auto block w-full rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-4 text-center font-bold text-white hover:from-primary-700 hover:to-purple-700">✨ {t('payment.plans.studio.subscribe')}</PlanPurchaseLink></div>})}</div>}</section>
      <section id="compositor-premium" className="scroll-mt-24">
        <div className="mb-5"><h2 className="text-xl font-black sm:text-2xl">{t('payment.plans.composer.title')}</h2><p className="text-sm text-gray-400">{t('payment.plans.composer.description')}</p></div>
        {composerPlansWithPrices.length === 0 ? <div className="text-center py-16"><p className="text-gray-400 text-lg">{t('payment.plans.composer.empty')}</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{composerPlansWithPrices.map(({ plan, priceQuote }) => {
          const goldPlan = isGoldPlan(plan)
          const features = getPlanFeatures(plan)
          return <div key={plan.id} className={`relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-all sm:p-8 ${goldPlan ? 'bg-gradient-to-br from-yellow-950/30 via-gray-900/70 to-purple-950/40 border border-yellow-500/60 hover:border-yellow-400 shadow-lg shadow-yellow-950/20' : 'bg-gray-900/50 border border-gray-800 hover:border-primary-500'}`}>
            {goldPlan && <div className="absolute right-4 top-4 rounded-full border border-yellow-400/50 bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-200">{t('payment.plans.composer.gold')}</div>}
            <div className="mb-6"><h3 className="text-2xl font-bold mb-2">{plan.name}</h3>{priceQuote ? <div className="flex items-baseline flex-wrap" data-no-translate><span className="text-3xl font-bold text-primary-400">{formatCurrency(priceQuote.amount, priceQuote.currency)}</span><span className="text-gray-400 ml-2 text-sm">/{isUS ? (plan.durationMonths === 1 ? t('payment.plans.period.month') : plan.durationMonths === 12 ? t('payment.plans.period.year') : t('payment.plans.period.months', { count: plan.durationMonths })) : (plan.durationMonths === 12 ? t('payment.plans.period.year') : t('payment.plans.period.months', { count: plan.durationMonths }))}</span></div> : <p className="font-bold text-amber-300">{t('payment.plans.unavailable')}</p>}{plan.description && <p className="text-gray-400 mt-2 text-sm">{plan.description}</p>}</div>
            {features.length > 0 && <ul className="space-y-3 mb-8 flex-grow">{features.map((feature: string, index: number) => <li key={index} className="flex items-start space-x-2"><FiCheck className={`w-5 h-5 mt-0.5 flex-shrink-0 ${goldPlan ? 'text-yellow-300' : 'text-primary-400'}`} /><span className="text-gray-300 text-sm">{feature}</span></li>)}</ul>}
            {priceQuote ? <PlanPurchaseLink href={`/compositores/checkout?plan=${plan.slug}`} planType="composer" className="block w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium text-center mt-auto">{t('payment.plans.composer.subscribe')}</PlanPurchaseLink> : <span className="mt-auto block w-full cursor-not-allowed rounded-lg bg-gray-800 px-4 py-3 text-center font-medium text-gray-500">{t('payment.plans.unavailable')}</span>}
          </div>
        })}</div>}
      </section>
    </div></div></div>
  )
}
