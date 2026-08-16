import type { Metadata } from 'next'
import { Suspense } from 'react'
import JsonLd from '@/components/blog/JsonLd'
import BlogAnalytics from '@/components/blog/BlogAnalytics'
import { BLOG_DESCRIPTION, BLOG_TITLE, BLOG_URL } from '@/lib/blog/site'
import { organizationSchema, websiteSchema } from '@/lib/blog/schema'

export const metadata: Metadata = {
  metadataBase: new URL(BLOG_URL),
  title: {
    default: BLOG_TITLE,
    template: '%s | Blog DCC Music',
  },
  description: BLOG_DESCRIPTION,
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': `${BLOG_URL}/rss.xml`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: BLOG_URL,
    siteName: BLOG_TITLE,
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    images: [
      {
        url: 'https://www.dccmusic.online/logopng.png',
        width: 1200,
        height: 630,
        alt: 'DCC Music',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    images: ['https://www.dccmusic.online/logopng.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
      <Suspense fallback={null}>
        <BlogAnalytics />
      </Suspense>
      {children}
    </>
  )
}
