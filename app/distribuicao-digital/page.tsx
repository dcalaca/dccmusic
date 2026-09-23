import Image from 'next/image'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import {
  FiArrowRight,
  FiBarChart2,
  FiCheck,
  FiExternalLink,
  FiHeadphones,
  FiHeart,
  FiSpeaker,
  FiMusic,
  FiShield,
  FiZap,
} from 'react-icons/fi'

async function getPageI18n() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  return createDccI18n(getLocaleForCountry(country))
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  return {
    title: t('digitalDistribution.metaTitle'),
    description: t('digitalDistribution.metaDescription'),
    keywords: ['DCC Music', 'SomVibe', 'Spotify', 'Apple Music', 'digital distribution'],
    alternates: { canonical: '/distribuicao-digital' },
    openGraph: {
      title: t('digitalDistribution.metaTitle'),
      description: t('digitalDistribution.metaDescription'),
      url: 'https://www.dccmusic.online/distribuicao-digital',
      type: 'website',
    },
  }
}

const SOMVIBE_AFFILIATE_URL = 'https://app.somvibe.com/invite/d/11197'

const platforms = ['Spotify', 'Apple Music', 'TikTok', 'YouTube', 'Amazon Music', 'Deezer']

const benefitIcons = [FiMusic, FiHeadphones, FiBarChart2, FiHeart]
const serviceIcons = [FiZap, FiSpeaker, FiShield, FiCheck]
const plans = [
  { key: 'annual', price: 'R$ 22,90', tone: 'border-primary-400/70 bg-gradient-to-br from-primary-950/60 via-gray-950 to-black', url: 'https://app.somvibe.com/invite/a/11197' },
  { key: 'semiannual', price: 'R$ 34,90', tone: 'border-gray-800 bg-gray-950/70', url: 'https://app.somvibe.com/invite/b/11197' },
  { key: 'quarterly', price: 'R$ 45,90', tone: 'border-gray-800 bg-gray-950/70', url: 'https://app.somvibe.com/invite/q/11197' },
]

function AffiliateButton({
  children,
  className = '',
  href = SOMVIBE_AFFILIATE_URL,
}: {
  children: ReactNode
  className?: string
  href?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  )
}

export default async function DistribuicaoDigitalPage() {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  const benefits = benefitIcons.map((icon, index) => ({
    icon,
    title: t(`digitalDistribution.benefits.${index}.title`),
    text: t(`digitalDistribution.benefits.${index}.text`),
  }))
  const services = serviceIcons.map((icon, index) => ({
    icon,
    title: t(`digitalDistribution.services.${index}.title`),
    text: t(`digitalDistribution.services.${index}.text`),
  }))
  const planFeatures = Array.from({ length: 7 }, (_, index) => t(`digitalDistribution.planFeatures.${index}`))
  return (
    <div className="min-h-screen overflow-hidden bg-black">
      <section className="relative py-10 sm:py-16">
        <div className="absolute left-1/2 top-0 hidden h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-cyan-600/15 blur-3xl sm:block" />
        <div className="absolute right-0 top-32 hidden h-72 w-72 rounded-full bg-primary-500/20 blur-3xl sm:block" />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 flex justify-center">
              <Image
                src="/Somvibe.png"
                alt="SomVibe"
                width={360}
                height={92}
                className="h-16 w-auto sm:h-20"
                priority
              />
            </div>
            <p className="mb-5 text-xs font-bold uppercase tracking-wide text-cyan-300/90">{t('digitalDistribution.partner')}</p>

            <h1 className="mb-4 text-3xl font-black leading-tight sm:text-5xl">
              <span className="gradient-text">{t('digitalDistribution.heroTitle')}</span>
            </h1>
            <p className="mx-auto mb-3 max-w-3xl text-base font-semibold leading-snug text-gray-100 sm:text-xl">{t('digitalDistribution.heroLead')}</p>
            <p className="mx-auto mb-7 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">{t('digitalDistribution.heroText')}</p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AffiliateButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-black text-white transition hover:bg-primary-700 sm:text-base">{t('digitalDistribution.distribute')}<FiExternalLink className="h-4 w-4" />
              </AffiliateButton>
              <a
                href="#planos"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-6 py-3.5 text-sm font-bold text-gray-200 transition hover:border-primary-400 hover:text-white"
              >{t('digitalDistribution.viewPlans')}<FiArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1.5 text-xs font-semibold text-gray-300"
                >
                  {platform}
                </span>
              ))}
              <span className="rounded-full border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-200">{t('digitalDistribution.morePlatforms')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">{t('digitalDistribution.whyTitle')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('digitalDistribution.whyText')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 transition hover:border-cyan-500/50"
                >
                  <Icon className="mb-3 h-5 w-5 text-cyan-300" />
                  <h3 className="mb-2 text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">{t('digitalDistribution.offerTitle')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('digitalDistribution.offerText')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-950 to-black p-5"
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-600/20 text-primary-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mb-2 text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-24 py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">{t('digitalDistribution.plansTitle')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('digitalDistribution.plansText')}</p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.key} className={`rounded-2xl border p-5 ${plan.tone}`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('digitalDistribution.planLabel', { name: t(`digitalDistribution.${plan.key}`) })}</p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-3xl font-black text-white">{plan.price}</span>
                      <span className="pb-1 text-sm text-gray-400">{t('digitalDistribution.perMonth')}</span>
                    </div>
                  </div>
                  {plan.key === 'annual' ? (
                    <span className="rounded-full border border-primary-400/50 bg-primary-600/20 px-3 py-1 text-[11px] font-bold text-primary-100">
                      {t('digitalDistribution.bestValue')}
                    </span>
                  ) : null}
                </div>

                <ul className="mb-5 space-y-2">
                  {planFeatures.map((feature) => (
                    <li key={`${plan.key}-${feature}`} className="flex items-start gap-2 text-xs text-gray-300">
                      <FiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <AffiliateButton
                  href={plan.url}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white transition hover:bg-primary-700"
                >{t('digitalDistribution.subscribe')}<FiExternalLink className="h-4 w-4" />
                </AffiliateButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex justify-center">
              <Image
                src="/Somvibe.png"
                alt="SomVibe"
                width={320}
                height={82}
                className="h-14 w-auto sm:h-16"
              />
            </div>
            <div className="overflow-hidden rounded-3xl border border-cyan-800/50 bg-gradient-to-br from-cyan-950/40 via-gray-950 to-black p-6 sm:p-10">
              <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left">
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-white sm:text-3xl">{t('digitalDistribution.finalTitle')}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-gray-300">{t('digitalDistribution.finalText')}</p>
                </div>
                <div className="w-full max-w-xs shrink-0">
                  <AffiliateButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-4 text-sm font-black text-white transition hover:bg-primary-700">{t('digitalDistribution.start')}<FiExternalLink className="h-4 w-4" />
                  </AffiliateButton>
                  <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{t('digitalDistribution.redirect')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
