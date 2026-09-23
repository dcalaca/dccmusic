import Link from 'next/link'
import { headers } from 'next/headers'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

type SeoAiLandingPageProps = {
  eyebrow: string
  title: string
  description: string
  intro: string
  benefits: string[]
  steps: string[]
  faq: Array<{ question: string; answer: string }>
}

const relatedPages = [
  { href: '/criar-musica-com-ia', key: 'ai' },
  { href: '/gerador-de-musica-ia', key: 'generator' },
  { href: '/criar-musica-gratis', key: 'free' },
  { href: '/criar-musica-online', key: 'online' },
]

export default async function SeoAiLandingPage({
  eyebrow,
  title,
  description,
  intro,
  benefits,
  steps,
  faq,
}: SeoAiLandingPageProps) {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-gradient-to-b from-violet-950/60 to-black">
        <div className="container mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-200">{description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/studio-ia"
              className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500"
            >
              {t('seoLanding.common.create')}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              {t('seoLanding.common.login')}
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-400">{t('seoLanding.common.firstFree')}</p>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-bold">{t('seoLanding.common.ideaTitle')}</h2>
            <p className="mt-4 text-base leading-7 text-gray-300">{intro}</p>

            <h2 className="mt-10 text-2xl font-bold">{t('seoLanding.common.benefitsTitle')}</h2>
            <ul className="mt-5 space-y-3 text-gray-300">
              {benefits.map((benefit) => (
                <li key={benefit} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-6">
            <h2 className="text-2xl font-bold">{t('seoLanding.common.stepsTitle')}</h2>
            <ol className="mt-5 space-y-5">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 font-bold">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-gray-200">{step}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/10 bg-gray-950">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">{t('seoLanding.common.faqTitle')}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faq.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-black p-5">
                <h3 className="font-semibold text-white">{item.question}</h3>
                <p className="mt-2 leading-6 text-gray-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold">{t('seoLanding.common.relatedTitle')}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {relatedPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-200 transition hover:border-purple-400 hover:text-white"
            >
              {t(`seoLanding.common.related.${page.key}`)}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
