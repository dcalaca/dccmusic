import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

async function getPageI18n() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  return createDccI18n(getLocaleForCountry(country))
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  return {
    title: t('musicTranscription.metaTitle'),
    description: t('musicTranscription.metaDescription'),
    keywords: ['DCC Music', 'Studio IA', 'chords', 'song lyrics', 'PDF'],
    alternates: { canonical: '/transcricao-musical' },
    openGraph: {
      title: t('musicTranscription.metaOgTitle'),
      description: t('musicTranscription.metaOgDescription'),
      url: 'https://www.dccmusic.online/transcricao-musical',
      type: 'website',
    },
  }
}

export default async function TranscricaoMusicalLayout({ children }: { children: React.ReactNode }) {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: t('musicTranscription.schemaName'),
    description: t('musicTranscription.schemaDescription'),
    provider: { '@type': 'Organization', name: 'DCC Music', url: 'https://www.dccmusic.online' },
    areaServed: ['BR', 'PT', 'US', 'GB', 'ES', 'MX', 'CO', 'PY'],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      {children}
    </>
  )
}
