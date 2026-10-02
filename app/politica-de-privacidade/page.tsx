import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export const metadata: Metadata = {
  title: 'Política de Privacidade | DCC Music',
  alternates: { canonical: 'https://www.dccmusic.online/politica-de-privacidade' },
}

export default async function PrivacyPage() {
  const locale = getLocaleForCountry(normalizeCountry(headers().get('x-dcc-country')))
  const i18n = await createDccI18n(locale)
  const t = i18n.t.bind(i18n)
  const sections = t('privacy.sections', { returnObjects: true }) as { title: string; body: string }[]
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{t('privacy.title')}</h1>
      <p className="mb-8 text-sm text-gray-400">{t('privacy.updated')}</p>
      <p className="mb-10 leading-relaxed text-gray-300">{t('privacy.intro')}</p>
      <div className="space-y-8">
        {sections.map(section => (
          <section key={section.title}>
            <h2 className="mb-3 text-xl font-semibold">{section.title}</h2>
            <p className="leading-relaxed text-gray-300">{section.body}</p>
          </section>
        ))}
      </div>
      <a href="mailto:suporte@dccmusic.online" className="mt-10 inline-block break-all text-primary-400 hover:underline">suporte@dccmusic.online</a>
    </article>
  )
}
