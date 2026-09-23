'use client'

import Link from 'next/link'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

export default function StudioTopupFailurePage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md rounded-3xl border border-red-800 bg-red-950/30 p-8 text-center">
          <FiAlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          <h1 className="mb-3 text-3xl font-black">{t('payment.topup.failure.title')}</h1>
          <p className="mb-3 text-gray-200">{t('payment.topup.failure.description')}</p>
          <p className="mb-6 text-sm leading-relaxed text-gray-400">{t('payment.topup.failure.explanation')}</p>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold"
          >
            <FiRefreshCw /> {t('payment.topup.failure.action')}
          </Link>
        </div>
      </div>
    </div>
  )
}
