import type { MetadataRoute } from 'next'
import { getPublishedPosts, getUsedAuthors, getUsedCategories, getUsedTags } from '@/lib/blog/posts'
import { BLOG_URL } from '@/lib/blog/site'

export const revalidate = 3600

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts()
  const lastPost = posts[0]?.updatedAt || posts[0]?.publishedAt || new Date().toISOString()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BLOG_URL,
      lastModified: lastPost,
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  const articleRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BLOG_URL}/${post.slug}`,
    lastModified: post.updatedAt || post.publishedAt,
    changeFrequency: post.pillar ? 'weekly' : 'monthly',
    priority: post.pillar ? 0.9 : post.featured ? 0.8 : 0.7,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = getUsedCategories()
    .filter(Boolean)
    .map((slug) => ({
      url: `${BLOG_URL}/categoria/${slug}`,
      lastModified: lastPost,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

  const tagRoutes: MetadataRoute.Sitemap = getUsedTags().map((slug) => ({
    url: `${BLOG_URL}/tag/${slug}`,
    lastModified: lastPost,
    changeFrequency: 'weekly',
    priority: 0.4,
  }))

  const authorRoutes: MetadataRoute.Sitemap = getUsedAuthors().map((slug) => ({
    url: `${BLOG_URL}/autor/${slug}`,
    lastModified: lastPost,
    changeFrequency: 'weekly',
    priority: 0.4,
  }))

  return [...staticRoutes, ...articleRoutes, ...categoryRoutes, ...tagRoutes, ...authorRoutes]
}
