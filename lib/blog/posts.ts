import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { cache } from 'react'
import { BLOG_RESERVED_SLUGS, POSTS_PER_PAGE } from './site'
import { getBlogRedirect } from './redirects'
import { readingTimeMinutes } from './markdown'
import { getBlogCategory, getBlogCluster, getBlogTag } from './taxonomy'
import { getBlogAuthor } from './authors'
import type { BlogFrontmatter, BlogPost, PostStatus } from './types'

const POSTS_DIR = path.join(process.cwd(), 'content/blog/posts')

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

function parseRelated(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((slug) => String(slug).trim()).filter(Boolean)
  }
  return []
}

function parseFaq(value: unknown): BlogFrontmatter['faq'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((item) => item.question && item.answer)
}

function parseStatus(value: unknown): PostStatus {
  if (value === 'draft' || value === 'redirect' || value === 'archived' || value === 'published') {
    return value
  }
  return 'draft'
}

function toFrontmatter(data: Record<string, unknown>, filename: string): BlogFrontmatter {
  const fileSlug = filename.replace(/\.mdx?$/, '')
  const slug = String(data.slug || fileSlug).trim()

  if (!slug) {
    throw new Error(`Artigo sem slug: ${filename}`)
  }
  if ((BLOG_RESERVED_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Slug reservado no blog: ${slug}`)
  }

  const publishedAt = String(data.publishedAt || '')
  const updatedAt = String(data.updatedAt || publishedAt)

  return {
    title: String(data.title || '').trim(),
    slug,
    description: String(data.description || data.excerpt || '').trim(),
    excerpt: String(data.excerpt || data.description || '').trim(),
    author: String(data.author || 'dcc-music').trim(),
    category: String(data.category || '').trim(),
    tags: parseTags(data.tags),
    featuredImage: String(data.featuredImage || '/logopng.png'),
    imageAlt: String(data.imageAlt || data.title || 'Imagem do artigo'),
    imageWidth: Number(data.imageWidth) > 0 ? Number(data.imageWidth) : 1200,
    imageHeight: Number(data.imageHeight) > 0 ? Number(data.imageHeight) : 630,
    publishedAt,
    updatedAt,
    status: parseStatus(data.status),
    featured: Boolean(data.featured),
    pillar: Boolean(data.pillar),
    cluster: data.cluster ? String(data.cluster).trim() : undefined,
    related: parseRelated(data.related),
    canonical: data.canonical ? String(data.canonical).trim() : undefined,
    seoTitle: data.seoTitle ? String(data.seoTitle).trim() : undefined,
    seoDescription: data.seoDescription ? String(data.seoDescription).trim() : undefined,
    noindex: Boolean(data.noindex),
    redirectTo: data.redirectTo ? String(data.redirectTo).trim() : undefined,
    faq: parseFaq(data.faq),
  }
}

function readPostFile(filename: string): BlogPost | null {
  if (filename.startsWith('_') || filename.startsWith('.')) return null
  if (!/\.mdx?$/.test(filename)) return null

  const filepath = path.join(POSTS_DIR, filename)
  const raw = fs.readFileSync(filepath, 'utf8')
  const parsed = matter(raw)
  const frontmatter = toFrontmatter(parsed.data as Record<string, unknown>, filename)

  if (!frontmatter.title) {
    throw new Error(`Artigo sem título: ${filename}`)
  }

  return {
    ...frontmatter,
    content: parsed.content.trim(),
    readingTimeMinutes: readingTimeMinutes(parsed.content),
    filepath,
  }
}

export const getAllPosts = cache((): BlogPost[] => {
  if (!fs.existsSync(POSTS_DIR)) return []

  return fs
    .readdirSync(POSTS_DIR)
    .map((filename) => {
      try {
        return readPostFile(filename)
      } catch (error) {
        console.error(`[blog] Falha ao ler ${filename}:`, error)
        return null
      }
    })
    .filter((post): post is BlogPost => Boolean(post))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
})

export function getPublishedPosts() {
  return getAllPosts().filter((post) => post.status === 'published')
}

export function getPostBySlug(slug: string) {
  return getAllPosts().find((post) => post.slug === slug)
}

export function getPublishedPostBySlug(slug: string) {
  const post = getPostBySlug(slug)
  if (!post || post.status !== 'published') return null
  return post
}

export function resolvePostRoute(slug: string) {
  const mapped = getBlogRedirect(slug)
  if (mapped) {
    return { type: 'redirect' as const, to: mapped }
  }

  const post = getPostBySlug(slug)
  if (!post) return { type: 'missing' as const }
  if (post.status === 'redirect' && post.redirectTo) {
    return { type: 'redirect' as const, to: post.redirectTo }
  }
  if (post.status !== 'published') return { type: 'missing' as const }
  return { type: 'post' as const, post }
}

export function getPostsByCategory(categorySlug: string) {
  return getPublishedPosts().filter((post) => post.category === categorySlug)
}

export function getPostsByTag(tagSlug: string) {
  return getPublishedPosts().filter((post) => post.tags.includes(tagSlug))
}

export function getPostsByAuthor(authorSlug: string) {
  return getPublishedPosts().filter((post) => post.author === authorSlug)
}

export function getPostsByCluster(clusterSlug: string) {
  return getPublishedPosts().filter((post) => post.cluster === clusterSlug)
}

export function getFeaturedPosts(limit = 3) {
  const featured = getPublishedPosts().filter((post) => post.featured)
  if (featured.length >= limit) return featured.slice(0, limit)
  const extras = getPublishedPosts().filter((post) => !featured.some((item) => item.slug === post.slug))
  return [...featured, ...extras].slice(0, limit)
}

export function getRecentPosts(limit = 6, excludeSlugs: string[] = []) {
  return getPublishedPosts()
    .filter((post) => !excludeSlugs.includes(post.slug))
    .slice(0, limit)
}

export function getPillarPosts() {
  return getPublishedPosts().filter((post) => post.pillar)
}

export function getRelatedPosts(post: BlogPost, limit = 3) {
  const published = getPublishedPosts().filter((item) => item.slug !== post.slug)
  const explicit = post.related
    .map((slug) => published.find((item) => item.slug === slug))
    .filter((item): item is BlogPost => Boolean(item))

  const scored = published
    .filter((item) => !explicit.some((related) => related.slug === item.slug))
    .map((item) => {
      let score = 0
      if (post.cluster && item.cluster === post.cluster) score += 5
      if (item.pillar && post.cluster && item.slug === getBlogCluster(post.cluster)?.pillarSlug) score += 4
      const sharedTags = item.tags.filter((tag) => post.tags.includes(tag)).length
      score += sharedTags * 2
      if (item.category === post.category) score += 0.25
      return { item, score }
    })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score || +new Date(b.item.publishedAt) - +new Date(a.item.publishedAt))
    .map((entry) => entry.item)

  return [...explicit, ...scored].slice(0, limit)
}

export function searchPosts(query: string) {
  const normalized = normalizeSearch(query)
  if (!normalized) return []

  return getPublishedPosts().filter((post) => {
    const haystack = normalizeSearch(
      [post.title, post.excerpt, post.description, post.category, post.tags.join(' '), getBlogCategory(post.category)?.title]
        .filter(Boolean)
        .join(' ')
    )
    return haystack.includes(normalized)
  })
}

export function paginatePosts(posts: BlogPost[], page = 1, perPage = POSTS_PER_PAGE) {
  const total = posts.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const start = (currentPage - 1) * perPage
  return {
    items: posts.slice(start, start + perPage),
    page: currentPage,
    totalPages,
    total,
    perPage,
  }
}

export function getUsedCategories() {
  return [...new Set(getPublishedPosts().map((post) => post.category).filter(Boolean))]
}

export function getUsedTags() {
  return [...new Set(getPublishedPosts().flatMap((post) => post.tags))]
}

export function getUsedAuthors() {
  return [...new Set(getPublishedPosts().map((post) => post.author))]
}

export function assertPostRelations(post: BlogPost) {
  if (!getBlogCategory(post.category)) {
    console.warn(`[blog] Categoria desconhecida em ${post.slug}: ${post.category}`)
  }
  if (!getBlogAuthor(post.author)) {
    console.warn(`[blog] Autor desconhecido em ${post.slug}: ${post.author}`)
  }
  post.tags.forEach((tag) => {
    if (!getBlogTag(tag)) {
      console.warn(`[blog] Tag desconhecida em ${post.slug}: ${tag}`)
    }
  })
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
