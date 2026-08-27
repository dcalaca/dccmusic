import type { ReactNode } from 'react'
import ComposerPublicNameEditor from '@/components/ComposerPublicNameEditor'
import PremiumDirectoryVisibilityCard from './PremiumDirectoryVisibilityCard'

export default function ComposerMyDataLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ComposerPublicNameEditor />
      <div className="container mx-auto px-4 pb-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <PremiumDirectoryVisibilityCard />
        </div>
      </div>
    </>
  )
}
