'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ComposerStatus = 'guest' | 'premium' | 'basic'

type ComposerSignupCtaProps = {
  guestLabel: string
  className: string
}

export default function ComposerSignupCta({ guestLabel, className }: ComposerSignupCtaProps) {
  const [status, setStatus] = useState<ComposerStatus>('guest')

  useEffect(() => {
    const composerToken = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!composerToken || !composerData) {
      setStatus('guest')
      return
    }

    try {
      const composer = JSON.parse(composerData)
      setStatus(composer?.isPremium ? 'premium' : 'basic')
    } catch {
      setStatus('guest')
    }
  }, [])

  const cta = status === 'premium'
    ? {
        href: '/compositores/admin/musicas/nova',
        label: 'Cadastrar música',
      }
    : status === 'basic'
      ? {
          href: '/compositores/planos#compositor-premium',
          label: 'Ver planos de Compositor Premium',
        }
      : {
          href: '/compositores/cadastro',
          label: guestLabel,
        }

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  )
}
