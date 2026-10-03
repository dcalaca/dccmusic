'use client'

import { useTranslation } from 'react-i18next'
import { FiGlobe } from 'react-icons/fi'
import { localeLabels, supportedLocales } from '@/i18n/config'
import { useLocalization } from './LocalizationProvider'

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocalization()
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-2 text-gray-200" data-no-translate>
      <FiGlobe className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />
      <select aria-label={t('global.language.choose')} value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className={`min-w-0 bg-gray-950 text-xs outline-none ${compact ? 'max-w-32' : 'max-w-44'}`}>
        {supportedLocales.map((item) => <option key={item} value={item}>{localeLabels[item]}</option>)}
      </select>
    </label>
  )
}
