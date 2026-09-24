'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { FiCheckCircle, FiXCircle, FiLoader, FiMail } from 'react-icons/fi'

type VerifyState = 'loading' | 'success' | 'error'

type VerifyComposerEmailClientProps = {
  token: string
  language: 'pt' | 'en' | 'es'
}

const LOCALE_BY_LANGUAGE = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
} as const

export default function VerifyComposerEmailClient({ token, language }: VerifyComposerEmailClientProps) {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const requestedRef = useRef(false)
  const [state, setState] = useState<VerifyState>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const locale = LOCALE_BY_LANGUAGE[language]
    if (!i18n.language.startsWith(language)) void i18n.changeLanguage(locale)
  }, [i18n, language])

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    const locale = i18n.language.startsWith(language) ? i18n.language : LOCALE_BY_LANGUAGE[language]
    const translate = i18n.getFixedT(locale)

    async function confirmEmail() {
      let feedback = translate('auth.verify.confirmError')
      try {
        setMessage(translate('auth.verify.confirming'))
        if (!token) {
          feedback = translate('auth.verify.missingToken')
          throw new Error(feedback)
        }

        const response = await fetch('/api/compositores/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.ok) {
          feedback = data?.reason === 'missing' ? translate('auth.verify.missingToken') : ['invalid', 'used', 'expired'].includes(data?.reason) ? translate('auth.verify.expired') : feedback
          throw new Error(feedback)
        }

        if (!data.login?.token || !data.login?.composer) {
          feedback = translate('auth.verify.loginError')
          throw new Error(feedback)
        }

        localStorage.setItem('composer_token', data.login.token)
        localStorage.setItem('composer_data', JSON.stringify(data.login.composer))
        localStorage.removeItem('composer_token_temp')
        window.dispatchEvent(new Event('authChange'))

        setState('success')
        setMessage(translate('auth.verify.confirmed'))

        window.setTimeout(() => {
          router.replace(data.login.redirectTo || '/compositores/admin/studio-ia')
        }, 700)
      } catch (error: any) {
        setState('error')
        setMessage(feedback)
      }
    }

    confirmEmail()
  }, [router, i18n, language, token])

  const success = state === 'success'
  const error = state === 'error'

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className={`mx-auto max-w-md rounded-3xl border p-8 text-center ${
          error
            ? 'border-red-800 bg-red-950/30'
            : success
              ? 'border-green-800 bg-green-950/30'
              : 'border-purple-800 bg-purple-950/30'
        }`}>
          {error ? (
            <FiXCircle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          ) : success ? (
            <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-green-300" />
          ) : (
            <FiLoader className="mx-auto mb-4 h-16 w-16 animate-spin text-purple-300" />
          )}

          <h1 className="mb-3 text-3xl font-black">
            {error ? t('auth.verify.unable') : success ? t('auth.verify.confirmedTitle') : t('auth.verify.confirmingTitle')}
          </h1>

          <p className="mb-6 text-gray-300">{message || t('auth.verify.confirming')}</p>

          {error ? (
            <Link
              href="/compositores/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
            >
              <FiMail />
              {t('auth.verify.login')}
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white">
              <FiLoader className="animate-spin" />
              {t('auth.verify.entering')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
