export type BlogAttribution = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  first_article_slug?: string
  last_article_slug?: string
  last_cta_product?: string
  landing_path?: string
  captured_at: string
}

export const BLOG_ATTRIBUTION_KEY = 'dcc_blog_attribution'

export function getStoredBlogAttribution(): BlogAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const data = JSON.parse(window.localStorage.getItem(BLOG_ATTRIBUTION_KEY) || 'null')
    if (!data?.captured_at) return null
    return data as BlogAttribution
  } catch {
    return null
  }
}

function saveBlogAttribution(data: BlogAttribution) {
  window.localStorage.setItem(BLOG_ATTRIBUTION_KEY, JSON.stringify(data))
}

export function captureBlogLanding(search: string, pathname: string, articleSlug?: string) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(search)
  const existing = getStoredBlogAttribution()
  const next: BlogAttribution = existing || {
    captured_at: new Date().toISOString(),
    landing_path: pathname,
  }

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
  for (const key of utmKeys) {
    const value = params.get(key)
    if (value && !next[key]) {
      next[key] = value
    }
  }

  if (!next.utm_source) {
    next.utm_source = 'blog'
    next.utm_medium = next.utm_medium || 'organic'
  }

  if (articleSlug) {
    if (!next.first_article_slug) next.first_article_slug = articleSlug
    next.last_article_slug = articleSlug
  }

  if (!next.landing_path) next.landing_path = pathname
  saveBlogAttribution(next)
}

export function rememberBlogCta(productId: string, articleSlug?: string) {
  if (typeof window === 'undefined') return
  const existing = getStoredBlogAttribution() || {
    captured_at: new Date().toISOString(),
    utm_source: 'blog',
    utm_medium: 'cta',
  }
  existing.last_cta_product = productId
  if (articleSlug) existing.last_article_slug = articleSlug
  if (!existing.utm_source) existing.utm_source = 'blog'
  if (!existing.utm_medium) existing.utm_medium = 'cta'
  if (articleSlug && !existing.utm_campaign) existing.utm_campaign = articleSlug
  saveBlogAttribution(existing)
}

export function blogAttributionEventPayload() {
  const data = getStoredBlogAttribution()
  if (!data) return {}
  return {
    traffic_source: 'blog',
    utm_source: data.utm_source || null,
    utm_medium: data.utm_medium || null,
    utm_campaign: data.utm_campaign || null,
    utm_content: data.utm_content || null,
    utm_term: data.utm_term || null,
    blog_article: data.last_article_slug || data.first_article_slug || null,
    blog_first_article: data.first_article_slug || null,
    blog_cta_product: data.last_cta_product || null,
  }
}
