'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from 'react-icons/fi'
import { getStoredPartnerAttribution } from '@/components/PartnerAttribution'
import { pushGtmEvent } from '@/components/GtmEvents'
import { blogAttributionEventPayload } from '@/lib/blog/attribution'
import { validateSignupEmail } from '@/lib/email-validation'

export default function ComposerSignupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSuggestion, setEmailSuggestion] = useState('')
  const [errorField, setErrorField] = useState<'email' | ''>('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get('email')?.trim()
    if (email) setFormData((current) => ({ ...current, email }))
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setEmailSuggestion('')
    setErrorField('')

    if (!formData.fullName.trim()) {
      setError(t('auth.errors.nameRequired'))
      return
    }

    const emailValidation = validateSignupEmail(formData.email)
    if (!emailValidation.valid) {
      setError(emailValidation.suggestion ? t('auth.errors.emailSuggestion', { email: emailValidation.suggestion }) : t('auth.errors.invalidEmail'))
      setEmailSuggestion(emailValidation.suggestion || '')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.errors.passwordMismatch'))
      return
    }

    setLoading(true)
    let feedback = t('auth.errors.signupFailed')
    try {
      const response = await fetch('/api/compositores/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailValidation.email,
          password: formData.password,
          accountName: formData.fullName,
          composerName: formData.fullName,
          forceCreate: true,
          partnerAttribution: getStoredPartnerAttribution(),
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.suggestion) {
          setEmailSuggestion(data.suggestion)
        }
        if (data.field === 'email' || ['EMAIL_TAKEN', 'DELETED_ACCOUNT'].includes(data.code)) {
          setErrorField('email')
        }
        const errorKey: Record<string, string> = {
          EMAIL_TAKEN: 'emailTaken',
          DELETED_ACCOUNT: 'deletedAccount',
          ARTIST_NAME_TAKEN: 'artistNameTaken',
          SIGNUP_CONFLICT: 'signupConflict',
          PASSWORD_TOO_SHORT: 'passwordTooShort',
          INVALID_EMAIL: 'invalidEmail',
          MISSING_FIELDS: 'signupFailed',
        }
        feedback = t(`auth.errors.${errorKey[data.code] || 'signupFailed'}`, { name: data.suggestionName || formData.fullName })
        throw new Error(feedback)
      }

      pushGtmEvent('dcc_complete_registration', {
        product_id: 'composer_signup',
        product_name: 'Cadastro de compositor',
        product_type: 'registration',
        event_id: data?.metaRegistrationEventId || null,
        value: 0.01,
        currency: 'BRL',
        ...blogAttributionEventPayload(),
      })
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        ;(window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'Cadastro de compositor',
          status: 'success',
          currency: 'BRL',
          value: 0.01,
        }, data?.metaRegistrationEventId ? { eventID: data.metaRegistrationEventId } : undefined)
      }
      if (typeof window !== 'undefined' && typeof (window as any).oaiq === 'function') {
        ;(window as any).oaiq('measure', 'registration_completed', {
          type: 'customer_action',
          amount: 0,
          currency: 'USD',
        })
      }
      router.push(
        `/compositores/login?cadastro=sucesso&email=${encodeURIComponent(formData.email)}`
      )
    } catch (err: any) {
      setError(feedback)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">{t('auth.signup.title')}</span>
            </h1>
            <p className="text-gray-400">
              {t('auth.signup.subtitle')}
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm space-y-2">
                  <p>{error}</p>
                  {emailSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, email: emailSuggestion })
                        setError('')
                        setEmailSuggestion('')
                        setErrorField('')
                      }}
                      className="rounded-lg border border-red-700 bg-red-950/60 px-3 py-2 text-left text-xs font-bold text-red-100 hover:bg-red-900/70"
                    >
                      {t('auth.signup.correctTo', { email: emailSuggestion })}
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">{t('auth.fields.name')}</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder={t('auth.placeholders.name')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('auth.fields.email')}</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => {
                      setFormData({ ...formData, email: event.target.value })
                      if (error || emailSuggestion || errorField === 'email') {
                        setError('')
                        setEmailSuggestion('')
                        setErrorField('')
                      }
                    }}
                    required
                    className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:border-primary-500 ${
                      errorField === 'email' ? 'border-red-500' : 'border-gray-700'
                    }`}
                    placeholder={t('auth.placeholders.email')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('auth.fields.password')}</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder={t('auth.placeholders.minPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('auth.actions.hidePassword') : t('auth.actions.showPassword')}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('auth.fields.confirmPassword')}</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder={t('auth.placeholders.confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? t('auth.actions.hidePassword') : t('auth.actions.showPassword')}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span>{t('auth.signup.creating')}</span>
                ) : (
                  <>
                    <span>{t('auth.signup.createAccount')}</span>
                    <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  {t('auth.signup.haveAccount')}{' '}
                  <Link href="/compositores/login" className="text-primary-400 hover:text-primary-300">
                    {t('auth.signup.signIn')}
                  </Link>
                </p>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <p className="text-center text-gray-400 text-sm mb-3">
                  {t('auth.signup.freeSongHint')}
                </p>
                <Link
                  href="/studio-ia"
                  className="block w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium text-center text-sm"
                >
                  {t('auth.signup.discoverStudio')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
