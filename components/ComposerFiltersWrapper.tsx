'use client'

import { Suspense } from 'react'
import ComposerFilters from './ComposerFilters'

interface ComposerFiltersWrapperProps {
  genres: Array<{ id: string; name: string; slug: string }>
}

export default function ComposerFiltersWrapper({ genres }: ComposerFiltersWrapperProps) {
  return (
    <Suspense fallback={<div className="mb-8 h-32 bg-gray-900/50 rounded-lg animate-pulse" />}>
      <ComposerFilters genres={genres} />
    </Suspense>
  )
}
