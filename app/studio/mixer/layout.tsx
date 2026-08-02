import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'DCC Studio',
  robots: {
    index: false,
    follow: false,
  },
}

export default function StudioMixerLayout({ children }: { children: ReactNode }) {
  return children
}
