'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiCheckCircle, FiXCircle, FiLoader, FiMail } from 'react-icons/fi'

type VerifyState = 'loading' | 'success' | 'error'

type VerifyComposerEmailClientProps = {
  token: string
  language: 'pt' | 'en' | 'es'
}

const COPY = {
  pt: { confirming: 'Confirmando seu e-mail e entrando na sua conta...', missingToken: 'Link sem token de confirmação.', confirmError: 'Não foi possível confirmar seu e-mail.', loginError: 'E-mail confirmado, mas não foi possível criar o login automático.', confirmed: 'E-mail confirmado. Entrando no seu painel...', expired: 'O link pode estar expirado, já ter sido usado ou estar incorreto.', unable: 'Não foi possível confirmar', confirmedTitle: 'E-mail confirmado', confirmingTitle: 'Confirmando e-mail', login: 'Ir para login', entering: 'Entrando no painel...' },
  en: { confirming: 'Confirming your email and signing you in...', missingToken: 'Confirmation link has no token.', confirmError: 'We could not confirm your email.', loginError: 'Your email was confirmed, but we could not create the automatic sign-in.', confirmed: 'Email confirmed. Taking you to your dashboard...', expired: 'The link may have expired, already been used, or be invalid.', unable: 'We could not confirm your email', confirmedTitle: 'Email confirmed', confirmingTitle: 'Confirming email', login: 'Go to login', entering: 'Opening your dashboard...' },
  es: { confirming: 'Confirmando tu correo e iniciando sesión...', missingToken: 'El enlace de confirmación no tiene token.', confirmError: 'No pudimos confirmar tu correo.', loginError: 'Tu correo fue confirmado, pero no pudimos iniciar sesión automáticamente.', confirmed: 'Correo confirmado. Entrando a tu panel...', expired: 'El enlace puede haber vencido, ya haber sido utilizado o ser incorrecto.', unable: 'No fue posible confirmar tu correo', confirmedTitle: 'Correo confirmado', confirmingTitle: 'Confirmando correo', login: 'Ir al inicio de sesión', entering: 'Entrando a tu panel...' },
} as const

export default function VerifyComposerEmailClient({ token, language }: VerifyComposerEmailClientProps) {
  const router = useRouter()
  const copy = COPY[language]
  const requestedRef = useRef(false)
  const [state, setState] = useState<VerifyState>('loading')
  const [message, setMessage] = useState<string>(copy.confirming)

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    async function confirmEmail() {
      try {
        if (!token) {
          throw new Error(copy.missingToken)
        }

        const response = await fetch('/api/compositores/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        })

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || copy.confirmError)
        }

        if (!data.login?.token || !data.login?.composer) {
          throw new Error(copy.loginError)
        }

        localStorage.setItem('composer_token', data.login.token)
        localStorage.setItem('composer_data', JSON.stringify(data.login.composer))
        localStorage.removeItem('composer_token_temp')
        window.dispatchEvent(new Event('authChange'))

        setState('success')
        setMessage(copy.confirmed)

        window.setTimeout(() => {
          router.replace(data.login.redirectTo || '/compositores/admin/studio-ia')
        }, 700)
      } catch (error: any) {
        setState('error')
        setMessage(error?.message || copy.expired)
      }
    }

    confirmEmail()
  }, [copy, router, token])

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
            {error ? copy.unable : success ? copy.confirmedTitle : copy.confirmingTitle}
          </h1>

          <p className="mb-6 text-gray-300">{message}</p>

          {error ? (
            <Link
              href="/compositores/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
            >
              <FiMail />
              {copy.login}
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white">
              <FiLoader className="animate-spin" />
              {copy.entering}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
