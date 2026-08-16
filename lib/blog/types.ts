import type { UtmParams } from './site'

export type PostStatus = 'draft' | 'published' | 'redirect' | 'archived'

export type BlogAuthor = {
  slug: string
  name: string
  role: string
  bio: string
  image: string
  imageAlt: string
  sameAs?: string[]
}

export type BlogCategory = {
  slug: string
  title: string
  description: string
  seoTitle?: string
  seoDescription?: string
}

export type BlogTag = {
  slug: string
  title: string
  description: string
}

export type BlogCluster = {
  slug: string
  title: string
  description: string
  pillarSlug: string
}

export type BlogProduct = {
  id: string
  label: string
  description: string
  path: string
  defaultCta: string
}

export type BlogFaqItem = {
  question: string
  answer: string
}

export type BlogFrontmatter = {
  title: string
  slug: string
  description: string
  excerpt: string
  author: string
  category: string
  tags: string[]
  featuredImage: string
  imageAlt: string
  imageWidth: number
  imageHeight: number
  publishedAt: string
  updatedAt: string
  status: PostStatus
  featured: boolean
  pillar: boolean
  cluster?: string
  related: string[]
  canonical?: string
  seoTitle?: string
  seoDescription?: string
  noindex: boolean
  redirectTo?: string
  faq: BlogFaqItem[]
}

export type BlogPost = BlogFrontmatter & {
  content: string
  readingTimeMinutes: number
  filepath: string
}

export type TocItem = {
  id: string
  text: string
  level: 2 | 3
}

export type BlogCtaContext = {
  articleSlug: string
  articleTitle: string
  productId: string
  utm?: UtmParams
}
