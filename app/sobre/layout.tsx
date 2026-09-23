import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export async function generateMetadata(): Promise<Metadata> {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)

  return {
    title: t('about.metaTitle'),
    description: t('about.metaDescription'),
    keywords: [
      'DCC Music',
      'Studio IA',
      'music',
      'AI',
      'songwriters',
    ],
    alternates: { canonical: '/sobre' },
    openGraph: {
      title: t('about.metaOgTitle'),
      description: t('about.metaOgDescription'),
      url: 'https://www.dccmusic.online/sobre',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('about.metaTwitterTitle'),
      description: t('about.metaTwitterDescription'),
    },
  }
}

export default function SobreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
