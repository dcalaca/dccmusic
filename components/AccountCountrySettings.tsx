'use client'

import { useTranslation } from 'react-i18next'
import CountrySelector from './CountrySelector'

export default function AccountCountrySettings() {
  const { t } = useTranslation()
  return (
    <details className="mt-5 rounded-2xl border border-white/10 bg-gray-950/80 p-4" data-no-translate>
      <summary className="cursor-pointer text-sm font-semibold text-gray-300">{t('global.country.correction')}</summary>
      <p className="mb-3 mt-3 text-sm text-gray-400">{t('global.country.correctionHint')}</p>
      <CountrySelector />
    </details>
  )
}
