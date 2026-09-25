import Link from 'next/link'
import { FiHome } from 'react-icons/fi'
import { createDccI18n } from '@/i18n/i18next'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import { headers } from 'next/headers'

export default async function NotFound() {
  const country = normalizeCountry(headers().get('x-dcc-country') || headers().get('x-vercel-ip-country') || headers().get('cf-ipcountry'))
  const i18n = await createDccI18n(getLocaleForCountry(country))
  const t = i18n.t.bind(i18n)
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">
          <span className="gradient-text">404</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">{t('notFound.description')}</p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <FiHome className="w-5 h-5" />
          <span>{t('notFound.backHome')}</span>
        </Link>
      </div>
    </div>
  )
}
