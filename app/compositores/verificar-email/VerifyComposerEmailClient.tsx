'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiCheckCircle, FiXCircle, FiLoader, FiMail } from 'react-icons/fi'

type VerifyState = 'loading' | 'success' | 'error'

type VerifyComposerEmailClientProps = {
  token: string
}

export default function VerifyComposerEmailClient({ token }: VerifyComposerEmailClientProps) {
  const router = useRouter()
  const requestedRef = useRef(false)
  const [state, setState] = useState<VerifyState>('loading')
  const [message, setMessage] = useState('Confirmando seu e-mail e entrando na sua conta...')

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    async function confirmEmail() {
      try {
        if (!token) {
          throw new Error('Link sem token de confirmação.')
        }

        const response = await fetch('/api/compositores/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        })

        const data = await response.json()

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'Não foi possível confirmar seu e-mail.')
        }

        if (!data.login?.token || !data.login?.composer) {
          throw new Error('E-mail confirmado, mas não foi possível criar o login automático.')
        }

        localStorage.setItem('composer_token', data.login.token)
        localStorage.setItem('composer_data', JSON.stringify(data.login.composer))
        localStorage.removeItem('composer_token_temp')
        window.dispatchEvent(new Event('authChange'))

        setState('success')
        setMessage('E-mail confirmado. Entrando no seu painel...')

        window.setTimeout(() => {
          router.replace(data.login.redirectTo || '/compositores/admin/studio-ia')
        }, 700)
      } catch (error: any) {
        setState('error')
        setMessage(error?.message || 'O link pode estar expirado, já ter sido usado ou estar incorreto.')
      }
    }

    confirmEmail()
  }, [router, token])

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
            {error ? 'Não foi possível confirmar' : success ? 'E-mail confirmado' : 'Confirmando e-mail'}
          </h1>

          <p className="mb-6 text-gray-300">{message}</p>

          {error ? (
            <Link
              href="/compositores/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
            >
              <FiMail />
              Ir para login
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white">
              <FiLoader className="animate-spin" />
              Entrando no painel...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
