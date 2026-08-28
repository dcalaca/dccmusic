import { NextRequest, NextResponse } from 'next/server'
import { isBlogHost, MAIN_SITE_PATH_PREFIXES } from '@/lib/blog/site'
import { COUNTRY_COOKIE, getLocaleForCountry, normalizeCountry } from '@/lib/localization'

const SITE_URL = 'https://www.dccmusic.online'
const BLOG_URL = 'https://blog.dccmusic.online'

function withSurface(response: NextResponse, surface: 'blog' | 'site') {
  response.headers.set('x-dcc-surface', surface)
  return response
}

function canonicalCookieHeader(request: NextRequest, country: string) {
  const parts = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.toLowerCase().startsWith(`${COUNTRY_COOKIE.toLowerCase()}=`))

  parts.push(`${COUNTRY_COOKIE}=${country}`)
  return parts.join('; ')
}

function resolveCountry(request: NextRequest) {
  return normalizeCountry(
    request.cookies.get(COUNTRY_COOKIE)?.value ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  )
}

function applyCountryToRequest(request: NextRequest, requestHeaders: Headers, country: ReturnType<typeof normalizeCountry>) {
  requestHeaders.set('x-dcc-country', country)
  requestHeaders.set('x-dcc-locale', getLocaleForCountry(country))
  // Garante que Server Components, APIs e middleware leiam o mesmo país,
  // mesmo se o navegador tiver deixado cookies duplicados/antigos.
  requestHeaders.set('cookie', canonicalCookieHeader(request, country))
}

function applyCountryToResponse(response: NextResponse, country: ReturnType<typeof normalizeCountry>) {
  response.headers.set('x-dcc-country', country)
  response.cookies.set(COUNTRY_COOKIE, country, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

function nextWithSurface(request: NextRequest, surface: 'blog' | 'site') {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-dcc-surface', surface)
  const country = resolveCountry(request)
  applyCountryToRequest(request, requestHeaders, country)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-dcc-surface', surface)
  return applyCountryToResponse(response, country)
}

function rewriteWithSurface(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-dcc-surface', 'blog')
  const country = resolveCountry(request)
  applyCountryToRequest(request, requestHeaders, country)
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  response.headers.set('x-dcc-surface', 'blog')
  return applyCountryToResponse(response, country)
}

function isStaticAsset(pathname: string) {
  return /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|css|js|map|mp3|mp4|webm|txt|xml)$/i.test(pathname)
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname, search } = request.nextUrl
  const blogHost = isBlogHost(host)

  if (!blogHost && pathname === '/api/admin/finance') {
    const url = request.nextUrl.clone()
    url.pathname = '/api/admin/finance-adjusted'
    return NextResponse.rewrite(url)
  }

  if (!blogHost && (pathname === '/blog' || pathname.startsWith('/blog/'))) {
    const hostname = host.split(':')[0]
    if (hostname === 'www.dccmusic.online' || hostname === 'dccmusic.online') {
      const dest = pathname.replace(/^\/blog/, '') || '/'
      return NextResponse.redirect(`${BLOG_URL}${dest}${search}`, 308)
    }
    return nextWithSurface(request, 'blog')
  }

  if (!blogHost) {
    return nextWithSurface(request, 'site')
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (pathname === '/robots.txt') {
    return rewriteWithSurface(request, '/blog/robots.txt')
  }

  if (pathname === '/sitemap.xml') {
    return rewriteWithSurface(request, '/blog/sitemap.xml')
  }

  if (pathname === '/rss.xml' || pathname === '/feed.xml') {
    return rewriteWithSurface(request, '/blog/rss.xml')
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const hitsMainSite = MAIN_SITE_PATH_PREFIXES.some(
    (prefix) => prefix !== '/api' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
  if (hitsMainSite) {
    return NextResponse.redirect(`${SITE_URL}${pathname}${search}`, 308)
  }

  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    const dest = pathname.replace(/^\/blog/, '') || '/'
    return withSurface(NextResponse.redirect(new URL(`${dest}${search}`, request.url), 308), 'blog')
  }

  const rewritten = pathname === '/' ? '/blog' : `/blog${pathname}`
  return rewriteWithSurface(request, rewritten)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
