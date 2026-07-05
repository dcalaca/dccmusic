'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type VerifiedComposerAutoLoginProps = {
  login: {
    token: string
    redirectTo: string
    composer: {
      id: string
      name: string
      slug?: string | null
      email: string
      isPremium?: boolean
      subscription_expires_at?: string | null
    }
  }
}

export default function VerifiedComposerAutoLogin({ login }: VerifiedComposerAutoLoginProps) {
  const router = useRouter()

  useEffect(() => {
    localStorage.setItem('composer_token', login.token)
    localStorage.setItem('composer_data', JSON.stringify(login.composer))
    localStorage.removeItem('composer_token_temp')
    window.dispatchEvent(new Event('authChange'))

    const timer = window.setTimeout(() => {
      router.replace(login.redirectTo || '/compositores/admin/studio-ia')
    }, 900)

    return () => window.clearTimeout(timer)
  }, [login, router])

  return null
}
