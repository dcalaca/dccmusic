import { NextResponse } from 'next/server'
import { BLOG_URL } from '@/lib/blog/site'

export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /busca
Disallow: /busca/
Disallow: /api/

Sitemap: ${BLOG_URL}/sitemap.xml
`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400',
    },
  })
}
