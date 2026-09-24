import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ComposerSignupCta from '@/components/ComposerSignupCta'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

async function getPageI18n() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  return createDccI18n(getLocaleForCountry(country))
}

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getPageI18n()
  return {
    title: i18n.t('composerSignupLanding.metaTitle'),
    description: i18n.t('composerSignupLanding.metaDescription'),
    alternates: { canonical: '/compositores-cadastro' },
  }
}

export default async function CompositoresCadastroLandingPage() {
  const i18n = await getPageI18n()
  const t = i18n.t.bind(i18n)
  return (
    <div className="relative min-h-[calc(100vh-7rem)] overflow-hidden">
      {/* Mesmo “clima” do hero da home: gradiente escuro + grade (sem print) */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/75 via-purple-950/70 to-black/85"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-25%,rgba(216,180,254,0.18),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(139,92,246,0.07)_40%,rgba(236,72,153,0.05)_100%)]" />

      <div className="relative z-10 mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14 lg:max-w-xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            {t('composerSignupLanding.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-purple-100/90 sm:text-lg">
            {t('composerSignupLanding.description')}
          </p>

          <div className="mt-8">
            <ComposerSignupCta
              guestLabel={t('composerSignupLanding.signup')}
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-bold text-violet-900 shadow-lg shadow-black/30 ring-2 ring-white/25 transition hover:bg-purple-50 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:ring-offset-2 focus:ring-offset-violet-950"
            />
          </div>
        </div>

        <ul className="mt-12 space-y-4 text-left text-purple-50/95">
          <li className="flex gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <span className="text-xl shrink-0" aria-hidden>
              🎧
            </span>
            <span className="text-sm sm:text-base leading-snug">{t('composerSignupLanding.benefits.listeners')}</span>
          </li>
          <li className="flex gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <span className="text-xl shrink-0" aria-hidden>
              ⭐
            </span>
            <span className="text-sm sm:text-base leading-snug">{t('composerSignupLanding.benefits.feedback')}</span>
          </li>
          <li className="flex gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <span className="text-xl shrink-0" aria-hidden>
              📈
            </span>
            <span className="text-sm sm:text-base leading-snug">{t('composerSignupLanding.benefits.visibility')}</span>
          </li>
        </ul>

        <div
          className="mt-10 grid grid-cols-2 gap-4 rounded-xl border border-fuchsia-500/25 bg-black/20 p-5 text-center backdrop-blur-sm"
          aria-label={t('composerSignupLanding.platformNumbers')}
        >
          <div>
            <p className="text-2xl font-bold text-white sm:text-3xl">+60</p>
            <p className="mt-1 text-xs text-purple-200/80 sm:text-sm">{t('composerSignupLanding.publishedSongs')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white sm:text-3xl">+20</p>
            <p className="mt-1 text-xs text-purple-200/80 sm:text-sm">{t('composerSignupLanding.registeredComposers')}</p>
          </div>
        </div>

        <div className="mt-10 text-center pb-4">
          <ComposerSignupCta
            guestLabel={t('composerSignupLanding.startNow')}
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500 hover:scale-[1.02] neon-glow focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-violet-950"
          />
        </div>
      </div>
    </div>
  )
}
