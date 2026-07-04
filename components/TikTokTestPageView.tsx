'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function TikTokTestPageView() {
  const searchParams = useSearchParams()
  const testId = searchParams.get('tt_test_id')

  useEffect(() => {
    if (!testId) return

    const timeout = window.setTimeout(() => {
      const ttq = (window as any).ttq
      if (typeof ttq?.page === 'function') {
        ttq.page()
      }
    }, 1800)

    return () => window.clearTimeout(timeout)
  }, [testId])

  return null
}
