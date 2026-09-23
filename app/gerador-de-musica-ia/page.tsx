import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import SeoAiLandingPage from '@/components/SeoAiLandingPage'

const pageKey = 'generator'
const canonical = '/gerador-de-musica-ia'

async function getPageI18n() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  return createDccI18n(getLocaleForCountry(country))
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  return {
    title: t(`seoLanding.pages.${pageKey}.metaTitle`),
    description: t(`seoLanding.pages.${pageKey}.metaDescription`),
    alternates: { canonical },
    openGraph: {
      title: t(`seoLanding.pages.${pageKey}.metaTitle`),
      description: t(`seoLanding.pages.${pageKey}.metaOgDescription`),
      url: `https://www.dccmusic.online${canonical}`,
      type: 'website',
    },
  }
}

export default async function Page() {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  return (
    <SeoAiLandingPage
      eyebrow={t(`seoLanding.pages.${pageKey}.eyebrow`)}
      title={t(`seoLanding.pages.${pageKey}.title`)}
      description={t(`seoLanding.pages.${pageKey}.description`)}
      intro={t(`seoLanding.pages.${pageKey}.intro`)}
      benefits={t(`seoLanding.pages.${pageKey}.benefits`, { returnObjects: true }) as string[]}
      steps={t(`seoLanding.pages.${pageKey}.steps`, { returnObjects: true }) as string[]}
      faq={t(`seoLanding.pages.${pageKey}.faq`, { returnObjects: true }) as Array<{ question: string; answer: string }>}
    />
  )
}
