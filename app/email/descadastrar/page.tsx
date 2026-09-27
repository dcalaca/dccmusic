import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { recordEmailOptOut } from '@/lib/email-opt-outs'
import { createDccI18n } from '@/i18n'
import { COUNTRY_COOKIE, getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export const dynamic = 'force-dynamic'

type UnsubscribeState =
  | { title: string; message: string; tone: 'success' | 'error' | 'warning' }

async function getUnsubscribeTranslator() {
  const h = headers()
  const country = normalizeCountry(
    cookies().get(COUNTRY_COOKIE)?.value ||
    h.get('x-dcc-country') ||
    h.get('x-vercel-ip-country') ||
    h.get('cf-ipcountry')
  )
  const i18n = await createDccI18n(getLocaleForCountry(country))
  return i18n.t.bind(i18n)
}

function getClientIp() {
  const headerList = headers()
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    null
  )
}

export default async function EmailUnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : ''
  const t = await getUnsubscribeTranslator()
  let state: UnsubscribeState

  if (!token) {
    state = {
      title: t('unsubscribe.invalidTitle'),
      message: t('unsubscribe.missingInfo'),
      tone: 'error',
    }
  } else {
    try {
      const headerList = headers()
      const result = await recordEmailOptOut({
        token,
        userAgent: headerList.get('user-agent'),
        ipAddress: getClientIp(),
      })

      if (result.success) {
        state = {
          title: t('unsubscribe.confirmedTitle'),
          message: t('unsubscribe.confirmedMessage'),
          tone: 'success',
        }
      } else if (result.reason === 'setup_required') {
        state = {
          title: t('unsubscribe.setupTitle'),
          message: t('unsubscribe.setupMessage'),
          tone: 'warning',
        }
      } else {
        state = {
          title: 'Link inválido',
          message: t('unsubscribe.invalidMessage'),
          tone: 'error',
        }
      }
    } catch {
      state = {
        title: t('unsubscribe.errorTitle'),
        message: t('unsubscribe.errorMessage'),
        tone: 'error',
      }
    }
  }

  const toneClass = {
    success: 'border-green-800 bg-green-950/25 text-green-100',
    warning: 'border-yellow-800 bg-yellow-950/25 text-yellow-100',
    error: 'border-red-800 bg-red-950/25 text-red-100',
  }[state.tone]

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <section className={`mx-auto max-w-xl rounded-3xl border p-6 shadow-2xl ${toneClass}`}>
        <p className="mb-2 text-sm font-black uppercase tracking-wide text-white/60">DCC Music</p>
        <h1 className="text-3xl font-black">{state.title}</h1>
        <p className="mt-4 leading-relaxed">{state.message}</p>
        <p className="mt-4 text-sm text-white/60">
          {t('unsubscribe.transactionalNotice')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-gray-200"
        >
          {t('unsubscribe.backSite')}
        </Link>
      </section>
    </main>
  )
}
