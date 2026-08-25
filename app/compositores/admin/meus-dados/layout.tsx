import type { ReactNode } from 'react'
import ComposerPublicNameEditor from '@/components/ComposerPublicNameEditor'

export default function ComposerMyDataLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ComposerPublicNameEditor />
    </>
  )
}
