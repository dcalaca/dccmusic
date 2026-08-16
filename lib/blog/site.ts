export const SITE_URL = 'https://www.dccmusic.online'
export const BLOG_URL = 'https://blog.dccmusic.online'
export const BLOG_TITLE = 'Blog DCC Music'
export const BLOG_DESCRIPTION =
  'Conteúdo sobre criação musical com inteligência artificial, composição, letras, produção, partitura, cifra e as ferramentas da DCC Music.'

export const BLOG_RESERVED_SLUGS = [
  'categoria',
  'tag',
  'busca',
  'autor',
  'pagina',
  'rss.xml',
  'feed.xml',
  'sitemap.xml',
  'robots.txt',
] as const

export const POSTS_PER_PAGE = 12
export const BLOG_PLACEHOLDER_IMAGE = '/logopng.png'

export function isPlaceholderBlogImage(src?: string | null) {
  if (!src) return true
  return src === BLOG_PLACEHOLDER_IMAGE || src.endsWith(BLOG_PLACEHOLDER_IMAGE)
}

export function isBlogHost(host?: string | null) {
  const hostname = (host || '').split(':')[0].toLowerCase()
  return hostname === 'blog.dccmusic.online' || hostname.startsWith('blog.')
}

export function blogHref(path = '/', host?: string | null) {
  const clean = normalizePath(path.replace(/^\/blog(?=\/|$)/, ''))
  if (process.env.NODE_ENV !== 'production') {
    if (isBlogHost(host)) return clean
    return clean === '/' ? '/blog' : `/blog${clean}`
  }
  return `${BLOG_URL}${clean === '/' ? '' : clean}`
}

export function blogAbsoluteUrl(path = '/') {
  const clean = normalizePath(path.replace(/^\/blog(?=\/|$)/, ''))
  return `${BLOG_URL}${clean === '/' ? '' : clean}`
}

export function siteAbsoluteUrl(path = '/') {
  const clean = normalizePath(path)
  return `${SITE_URL}${clean === '/' ? '' : clean}`
}

export type UtmParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export function siteHref(path: string, host?: string | null, utm?: UtmParams) {
  const clean = normalizePath(path)
  const useRelative = process.env.NODE_ENV !== 'production' && !isBlogHost(host)
  const base = useRelative ? clean : `${SITE_URL}${clean === '/' ? '' : clean}`
  return appendQuery(base, utm)
}

export function appendQuery(url: string, params?: Record<string, string | undefined>) {
  if (!params) return url
  const entries = Object.entries(params).filter(([, value]) => Boolean(value))
  if (!entries.length) return url

  const isAbsolute = /^https?:\/\//i.test(url)
  const parsed = new URL(url, SITE_URL)
  for (const [key, value] of entries) {
    if (value && !parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value)
    }
  }
  if (isAbsolute) return parsed.toString()
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

export function normalizePath(path: string) {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.slice(0, -1)
  }
  return withSlash || '/'
}

export const MAIN_SITE_PATH_PREFIXES = [
  '/studio-ia',
  '/transcricao-musical',
  '/distribuicao-digital',
  '/compositores',
  '/musicas',
  '/videos',
  '/sobre',
  '/faq',
  '/admin',
  '/login',
  '/minha-conta',
  '/links',
  '/embed',
  '/parceiros',
  '/compositores-cadastro',
  '/trocar-senha',
  '/email',
  '/api',
]
