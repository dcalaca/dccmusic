import { NextRequest, NextResponse } from 'next/server'
import { isBlogHost, MAIN_SITE_PATH_PREFIXES } from '@/lib/blog/site'
import { COUNTRY_COOKIE, getLocaleForCountry, normalizeCountry } from '@/lib/localization'

const SITE_URL = 'https://www.dccmusic.online'
const BLOG_URL = 'https://blog.dccmusic.online'

function withSurface(response: NextResponse, surface: 'blog' | 'site') {
  response.headers.set('x-dcc-surface', surface)
  return response
}

function nextWithSurface(request: NextRequest, surface: 'blog' | 'site') {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-dcc-surface', surface)
  const country = normalizeCountry(
    request.cookies.get(COUNTRY_COOKIE)?.value ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  )
  requestHeaders.set('x-dcc-country', country)
  requestHeaders.set('x-dcc-locale', getLocaleForCountry(country))
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-dcc-surface', surface)
  response.headers.set('x-dcc-country', country)
  return response
}

function rewriteWithSurface(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-dcc-surface', 'blog')
  const country = normalizeCountry(
    request.cookies.get(COUNTRY_COOKIE)?.value ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  )
  requestHeaders.set('x-dcc-country', country)
  requestHeaders.set('x-dcc-locale', getLocaleForCountry(country))
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  response.headers.set('x-dcc-surface', 'blog')
  return response
}

function isStaticAsset(pathname: string) {
  return /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|css|js|map|mp3|mp4|webm|txt|xml)$/i.test(pathname)
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname, search } = request.nextUrl
  const blogHost = isBlogHost(host)

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
