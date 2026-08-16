import { NextResponse } from 'next/server'
import { getPublishedPosts } from '@/lib/blog/posts'
import { BLOG_DESCRIPTION, BLOG_TITLE, BLOG_URL } from '@/lib/blog/site'

export const revalidate = 3600

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET() {
  const posts = getPublishedPosts().slice(0, 50)
  const items = posts
    .map((post) => {
      const url = `${BLOG_URL}/${post.slug}`
      return `<item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt || post.description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BLOG_TITLE)}</title>
    <link>${BLOG_URL}</link>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date(posts[0]?.updatedAt || posts[0]?.publishedAt || Date.now()).toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
