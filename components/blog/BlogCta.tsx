'use client'

import { rememberBlogCta } from '@/lib/blog/attribution'
import { pushGtmEvent } from '@/components/GtmEvents'
import { getBlogProduct } from '@/lib/blog/products'
import { siteHref, type UtmParams } from '@/lib/blog/site'

type BlogCtaProps = {
  product: string
  title?: string
  description?: string
  label?: string
  articleSlug?: string
  articleTitle?: string
  host?: string | null
}

export default function BlogCta({
  product,
  title,
  description,
  label,
  articleSlug,
  articleTitle,
  host,
}: BlogCtaProps) {
  const item = getBlogProduct(product)
  if (!item) return null

  const utm: UtmParams = {
    utm_source: 'blog',
    utm_medium: 'cta',
    utm_campaign: articleSlug || 'blog',
    utm_content: product,
  }

  const href = siteHref(item.path, host, utm)

  const handleClick = () => {
    rememberBlogCta(product, articleSlug)
    pushGtmEvent('dcc_blog_cta_click', {
      content_type: 'blog_cta',
      cta_product: product,
      cta_label: label || item.defaultCta,
      blog_article: articleSlug || null,
      blog_article_title: articleTitle || null,
      destination_path: item.path,
    })
  }

  return (
    <aside className="my-5 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-purple-300">Ferramenta DCC Music</p>
      <h2 className="mt-1 text-base font-bold text-white">{title || item.label}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-300">{description || item.description}</p>
      <a
        href={href}
        onClick={handleClick}
        className="mt-3 inline-flex rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
      >
        {label || item.defaultCta}
      </a>
    </aside>
  )
}
