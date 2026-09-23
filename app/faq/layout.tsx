import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export async function generateMetadata(): Promise<Metadata> {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)

  return {
    title: t('faqPage.metaTitle'),
    description: t('faqPage.metaDescription'),
    keywords: ['DCC Music', 'FAQ', 'Studio IA', 'AI music', 'song chords'],
    alternates: { canonical: '/faq' },
    openGraph: {
      title: t('faqPage.metaOgTitle'),
      description: t('faqPage.metaOgDescription'),
      type: 'website',
    },
  }
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
