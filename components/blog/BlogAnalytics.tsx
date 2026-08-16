'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureBlogLanding } from '@/lib/blog/attribution'
import { pushGtmEvent } from '@/components/GtmEvents'

export default function BlogAnalytics({
  articleSlug,
  articleTitle,
  category,
  cluster,
}: {
  articleSlug?: string
  articleTitle?: string
  category?: string
  cluster?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    captureBlogLanding(window.location.search, window.location.pathname, articleSlug)

    if (!articleSlug) return

    const timeout = window.setTimeout(() => {
      pushGtmEvent('dcc_blog_article_view', {
        content_type: 'blog_article',
        blog_article: articleSlug,
        blog_article_title: articleTitle || null,
        blog_category: category || null,
        blog_cluster: cluster || null,
        page_referrer: document.referrer || null,
      })
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [articleSlug, articleTitle, category, cluster, pathname, searchParams])

  return null
}
