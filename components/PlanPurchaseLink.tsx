'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type PlanPurchaseLinkProps = {
  href: string
  planType: 'studio' | 'composer'
  className: string
  children: React.ReactNode
}

export function PlanPurchaseLink({ href, planType, className, children }: PlanPurchaseLinkProps) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(true)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkActivePlan = async () => {
      const token = localStorage.getItem('composer_token')
      if (!token) {
        if (!cancelled) setChecking(false)
        return
      }

      try {
        const response = await fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const status = await response.json()

        if (!cancelled && response.ok) {
          setBlocked(
            planType === 'studio'
              ? Boolean(status?.hasStudioPlan)
              : Boolean(status?.hasComposerPremiumAccess)
          )
        }
      } catch (error) {
        console.error('[PLANOS] Erro ao verificar plano ativo:', error)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void checkActivePlan()
    return () => {
      cancelled = true
    }
  }, [planType])

  if (checking) {
    return (
      <button
        type="button"
        disabled
        className={`${className} cursor-not-allowed opacity-60`}
      >
        {t('payment.plans.checkingPlan')}
      </button>
    )
  }

  if (blocked) {
    return (
      <button
        type="button"
        disabled
        title={t('payment.plans.alreadyActiveTitle')}
        className={`${className} cursor-not-allowed opacity-60`}
      >
        {t('payment.plans.alreadyActive')}
      </button>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
