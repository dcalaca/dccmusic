import type { Metadata } from 'next'
import * as db from '@/lib/db'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { TikTokViewContent } from '@/components/TikTokEvents'
import { FreeMusicPlanNotice, StudioCouponButton, StudioHeroActions, StudioPlanButton, StudioTopupButton } from './StudioActions'
import { COUNTRY_COOKIE, normalizeCountry, getLocaleForCountry, type DccCountry } from '@/lib/localization'
import { createDccI18n } from '@/i18n'
import { getStudioPlanPriceQuote, type StudioTopupCurrency } from '@/lib/studio-topups'
import { getStudioPlanPricesFromPricing, getStudioTopupTiersFromPricing } from '@/lib/studio-pricing-server'
import { FiCheck, FiCpu, FiFileText, FiFolder, FiHeadphones, FiImage, FiMusic, FiPenTool, FiShield, FiShare2, FiStar, FiZap } from 'react-icons/fi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const featureDefinitions = [
  { icon: FiMusic, key: 'completeSongs' },
  { icon: FiPenTool, key: 'smartLyrics' },
  { icon: FiImage, key: 'aiCovers' },
  { icon: FiFolder, key: 'organizedProjects' },
  { icon: FiZap, key: 'dccPublishing' },
  { icon: FiHeadphones, key: 'professionalPlayer' },
  { icon: FiShare2, key: 'easySharing' },
  { icon: FiFileText, key: 'songChords' },
  { icon: FiStar, key: 'premiumLook' },
] as const

const workflowStepKeys = ['idea', 'lyrics', 'music', 'publish'] as const
const previewStepKeys = ['idea', 'lyrics', 'music', 'publish'] as const
const receiveKeys = ['fullLyrics', 'songWithVocals', 'promoCover', 'savedProject', 'publicLink'] as const

const studioPlanSlugs = ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia']
const planPresentation: Record<string, { idealKey: string; highlightKey?: string; tone: string }> = {
  'studio-start': { idealKey: 'beginnerUsers', tone: 'border-gray-800 bg-gray-950/70' },
  'studio-pro': { idealKey: 'activeComposers', highlightKey: 'mostPopular', tone: 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black shadow-2xl shadow-purple-950/30 scale-[1.02]' },
  'studio-elite': { idealKey: 'advancedCreators', tone: 'border-yellow-400/70 bg-gradient-to-br from-yellow-950/40 via-purple-950/50 to-black shadow-2xl shadow-yellow-950/20' },
  'dcc-studio-ia': { idealKey: 'activeComposers', tone: 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black' },
}

function getRequestCountry() {
  const requestHeaders = headers()
  return normalizeCountry(
    cookies().get(COUNTRY_COOKIE)?.value ||
    requestHeaders.get('x-dcc-country') ||
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry')
  )
}

async function getTranslator(country: DccCountry) {
  const i18n = await createDccI18n(getLocaleForCountry(country))
  return i18n.t.bind(i18n)
}

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return studioPlanSlugs.includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

function formatCurrency(value: number, currency: StudioTopupCurrency) {
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

async function getStudioPlans() {
  const plans = await db.getPlans()
  return plans.filter(isStudioPlan)
}

function StudioPricingFallback({ title, loadingText }: { title: string; loadingText: string }) {
  return (
    <section id="planos" className="min-h-[520px] scroll-mt-24 py-6 sm:py-10" aria-busy="true">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center sm:mb-8">
          <h2 className="text-2xl font-black sm:text-3xl"><span className="gradient-text">{title}</span></h2>
          <p className="mt-2 text-sm text-gray-400">{loadingText}</p>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-[1.5rem] border border-purple-700/30 bg-gray-950/70" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-64 rounded-[1.5rem] border border-gray-800 bg-gray-950/70" />)}
          </div>
        </div>
      </div>
    </section>
  )
}

async function StudioPricingSection({ country }: { country: DccCountry }) {
  const t = await getTranslator(country)
  const [plans, topupPricing, localizedPlanPrices] = await Promise.all([
    getStudioPlans(),
    getStudioTopupTiersFromPricing(country),
    getStudioPlanPricesFromPricing(studioPlanSlugs, country),
  ])
  const topupTiers = topupPricing.tiers
  const topupCurrency = topupPricing.currency
  const topupPresentation = [
    [t('studioLanding.pricing.topup.oneSong'), topupTiers[0].unitPrice],
    [t('studioLanding.pricing.topup.twoToEight'), topupTiers[1].unitPrice],
    [t('studioLanding.pricing.topup.nineToTwentyNine'), topupTiers[2].unitPrice],
    [t('studioLanding.pricing.topup.thirtyPlus'), topupTiers[4].unitPrice],
  ] as const

  const plansWithPrices = plans.flatMap((plan) => {
    const databasePrice = localizedPlanPrices[plan.slug]
    if (databasePrice) return [{ plan, priceQuote: databasePrice }]
    if (country === 'US' || country === 'GB') return []
    return [{ plan, priceQuote: { ...getStudioPlanPriceQuote(plan.price, country), source: 'fallback' as const } }]
  })

  // Reuse the exact offers rendered below; no extra pricing requests or free-plan claim.
  const applicationOffers = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://www.dccmusic.online/studio-ia#application',
    name: 'DCC Studio IA',
    offers: [
      {
        '@type': 'Offer',
        name: t('studioLanding.pricing.topup.oneSong'),
        url: 'https://www.dccmusic.online/studio-ia#planos',
        price: topupTiers[0].unitPrice,
        priceCurrency: topupCurrency,
      },
      ...plansWithPrices.map(({ plan, priceQuote }) => ({
        '@type': 'Offer',
        name: plan.name,
        url: 'https://www.dccmusic.online/studio-ia#planos',
        price: priceQuote.amount,
        priceCurrency: priceQuote.currency,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: priceQuote.amount,
          priceCurrency: priceQuote.currency,
          billingDuration: `P${plan.durationMonths}M`,
        },
      })),
    ],
  }

  return (
    <section id="planos" className="scroll-mt-24 py-6 sm:py-10">
      <script
        id="dcc-studio-offers-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(applicationOffers).replace(/</g, '\\u003c') }}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center sm:mb-8">
          <h2 className="text-2xl font-black sm:text-3xl"><span className="gradient-text">{t('studioLanding.pricing.title')}</span></h2>
          <p className="mt-2 text-sm text-gray-400">{t('studioLanding.pricing.subtitle')}</p>
          <FreeMusicPlanNotice />
        </div>

        <div className="mb-6 rounded-[1.5rem] border border-purple-700/50 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black p-4 sm:mb-7 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">{t('studioLanding.pricing.noSubscription')}</p>
              <h3 className="text-xl font-black sm:text-2xl">{t('studioLanding.pricing.topupTitle')}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">{t('studioLanding.pricing.topupDescription')}</p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[260px]">
              <StudioTopupButton />
              <StudioCouponButton />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
            {topupPresentation.map(([label, price]) => (
              <div key={label} className="rounded-2xl border border-gray-800 bg-black/50 p-3 sm:p-5">
                <p className="text-xs text-gray-400 sm:text-sm">{label}</p>
                <p className="mt-1 text-sm font-black text-white sm:mt-2 sm:text-xl">
                  {formatCurrency(price, topupCurrency)} {t('studioLanding.pricing.perSong')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {plansWithPrices.length === 0 ? (
          <div className="rounded-[2rem] border border-gray-800 bg-gray-950/70 p-10 text-center">
            <p className="text-lg font-bold text-white">{t('studioLanding.pricing.noPlans')}</p>
            <p className="mt-2 text-sm text-gray-400">{t('studioLanding.pricing.noPlansHint')}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {plansWithPrices.map(({ plan, priceQuote }) => {
              const presentation = planPresentation[plan.slug] || planPresentation['dcc-studio-ia']
              const planFeatures = (plan.featureKeys || []).map((key) =>
                t(`studioLanding.pricing.planFeatures.${key}`, { defaultValue: key })
              )
              return (
                <div key={plan.id} className={`relative rounded-[1.5rem] border p-5 sm:p-6 ${presentation.tone}`}>
                  {presentation.highlightKey && (
                    <div className="mb-3 inline-flex rounded-full border border-purple-300/60 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-100 sm:absolute sm:right-6 sm:top-6 sm:mb-0">
                      {t(`studioLanding.pricing.highlights.${presentation.highlightKey}`)}
                    </div>
                  )}
                  <h3 className="mb-1 text-xl font-black sm:text-2xl">{plan.name}</h3>
                  <p className="mb-3 text-sm text-gray-400">
                    {t('studioLanding.pricing.idealFor', { audience: t(`studioLanding.pricing.audiences.${presentation.idealKey}`) })}
                  </p>
                  <div className="mb-4">
                    <span className="text-3xl font-black text-white">{formatCurrency(priceQuote.amount, priceQuote.currency)}</span>
                    <span className="text-gray-400">/{t('studioLanding.pricing.months', { count: plan.durationMonths })}</span>
                  </div>
                  {planFeatures.length > 0 && (
                    <ul className="mb-5 space-y-2">
                      {planFeatures.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-gray-300">
                          <FiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-300" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  <StudioPlanButton planSlug={plan.slug} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const country = getRequestCountry()
  const t = await getTranslator(country)
  return {
    title: t('studioLanding.meta.title'),
    description: t('studioLanding.meta.description'),
    keywords: [
      t('studioLanding.meta.keywordStudio'),
      t('studioLanding.meta.keywordAiMusic'),
      t('studioLanding.meta.keywordCreate'),
      t('studioLanding.meta.keywordLyrics'),
      'DCC Music',
    ],
    alternates: { canonical: '/studio-ia' },
    openGraph: {
      title: t('studioLanding.meta.ogTitle'),
      description: t('studioLanding.meta.ogDescription'),
      url: 'https://www.dccmusic.online/studio-ia',
      type: 'website',
      siteName: 'DCC Music',
      locale: getLocaleForCountry(country).replace('-', '_'),
      images: [{ url: '/logopng.png', width: 880, height: 409, alt: 'DCC Music' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('studioLanding.meta.ogTitle'),
      description: t('studioLanding.meta.ogDescription'),
      images: ['/logopng.png'],
    },
  }
}

export default async function StudioIALandingPage() {
  const country = getRequestCountry()
  const t = await getTranslator(country)
  const features = featureDefinitions.map(({ icon, key }) => ({
    icon,
    title: t(`studioLanding.features.${key}.title`),
    text: t(`studioLanding.features.${key}.text`),
  }))
  const steps = workflowStepKeys.map((key, index) => [
    String(index + 1),
    t(`studioLanding.steps.${key}.title`),
    t(`studioLanding.steps.${key}.text`),
  ] as const)
  const previewSteps = previewStepKeys.map((key, index) => [
    String(index + 1),
    t(`studioLanding.preview.steps.${key}.title`),
    t(`studioLanding.preview.steps.${key}.text`),
  ] as const)
  const receiveItems = [
    { key: receiveKeys[0], icon: FiPenTool },
    { key: receiveKeys[1], icon: FiHeadphones },
    { key: receiveKeys[2], icon: FiImage },
    { key: receiveKeys[3], icon: FiFolder },
    { key: receiveKeys[4], icon: FiShare2 },
  ]

  return (
    <div className="min-h-screen overflow-hidden bg-black">
      <TikTokViewContent contentId="studio_ia" contentName="DCC Studio IA" />

      <section className="relative py-7 sm:py-14">
        <div className="absolute left-1/2 top-0 hidden h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-3xl sm:block" />
        <div className="absolute right-0 top-40 hidden h-72 w-72 rounded-full bg-primary-500/20 blur-3xl sm:block" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-xs font-bold text-purple-100">
              <FiCpu /> {t('studioLanding.hero.badge')}
            </div>
            <h1 className="mb-3 text-3xl font-black leading-tight sm:text-5xl"><span className="gradient-text">{t('studioLanding.hero.heading')}</span></h1>
            <p className="mx-auto mb-2 max-w-3xl text-base font-semibold leading-snug text-gray-100 sm:text-xl">{t('studioLanding.hero.title')}</p>
            <p className="mx-auto mb-5 max-w-3xl text-sm leading-relaxed text-gray-400">{t('studioLanding.hero.description')}</p>
            <StudioHeroActions />
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-[1.5rem] border border-purple-500/30 bg-gradient-to-br from-gray-950 via-black to-purple-950/40 p-3 shadow-2xl shadow-purple-950/30 sm:mt-8">
            <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-black/80 p-5 text-left">
                <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-purple-300">{t('studioLanding.preview.eyebrow')}</p>
                      <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">{t('studioLanding.preview.title')}</h3>
                    </div>
                    <span className="rounded-full border border-purple-500/40 bg-purple-600/20 px-3 py-1 text-xs font-bold text-purple-100">{t('studioLanding.preview.badge')}</span>
                  </div>
                  <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">{t('studioLanding.preview.musicPreview')}</p>
                    <div className="flex h-24 items-end gap-1.5">
                      {[38,64,45,82,58,94,52,76,43,88,61,72,49,90,55,68,42,80].map((height,index) => (
                        <span key={`${height}-${index}`} className="flex-1 rounded-t-md bg-gradient-to-t from-primary-600 to-purple-300" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{t('studioLanding.preview.audioContents')}</span>
                      <span>{t('studioLanding.preview.versions')}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {previewSteps.map(([number, title, text]) => (
                      <div key={number} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-black text-white">{number}</span>
                        <div><p className="text-sm font-bold text-white">{title}</p><p className="text-xs text-gray-500">{text}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-5 text-left">
                <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">{t('studioLanding.receive.title')}</p>
                <div className="space-y-3">
                  {receiveItems.map(({ key, icon: ItemIcon }) => (
                    <div key={key} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-black/40 p-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/20 text-purple-200"><ItemIcon className="h-4 w-4" /></span>
                      <span className="text-sm font-semibold text-gray-200">{t(`studioLanding.receive.${key}`)}</span>
                      <FiCheck className="ml-auto h-4 w-4 text-green-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5 text-center sm:mb-7">
            <h2 className="text-2xl font-black sm:text-3xl">{t('studioLanding.featuresTitle')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('studioLanding.featuresSubtitle')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 transition hover:border-purple-500">
                  <Icon className="mb-2 h-5 w-5 text-purple-300" />
                  <h3 className="mb-1 text-sm font-bold">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{feature.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5 text-center sm:mb-7"><h2 className="text-2xl font-black sm:text-3xl">{t('studioLanding.howItWorks')}</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {steps.map(([number, title, text]) => (
              <div key={number} className="flex gap-3 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-950 to-black p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-black">{number}</div>
                <div><h3 className="mb-1 text-sm font-bold">{title}</h3><p className="text-xs leading-relaxed text-gray-400">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-purple-700/50 bg-gradient-to-br from-purple-950/50 via-gray-950 to-black p-5 sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-200"><FiShield className="h-6 w-6" /></div>
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">{t('studioLanding.history.eyebrow')}</p>
                <h2 className="text-xl font-black sm:text-2xl">{t('studioLanding.history.title')}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">{t('studioLanding.history.description')}</p>
                <p className="mt-3 text-xs text-gray-500">{t('studioLanding.history.note')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<StudioPricingFallback title={t('studioLanding.pricing.title')} loadingText={t('studioLanding.pricing.loading')} />}>
        <StudioPricingSection country={country} />
      </Suspense>
    </div>
  )
}
