import { notFound } from 'next/navigation'
import BlogListing from '@/components/blog/BlogListing'
import JsonLd from '@/components/blog/JsonLd'
import { getPostsByCategory, getPostsByTag, paginatePosts } from '@/lib/blog/posts'
import { breadcrumbSchema } from '@/lib/blog/schema'
import { blogAbsoluteUrl, POSTS_PER_PAGE } from '@/lib/blog/site'
import { getBlogCategory, getBlogTag } from '@/lib/blog/taxonomy'

export function CategoryListing({ slug, page }: { slug: string; page: number }) {
  const category = getBlogCategory(slug)
  if (!category) notFound()

  const pagination = paginatePosts(getPostsByCategory(category.slug), page, POSTS_PER_PAGE)
  if (page > 1 && page > pagination.totalPages) notFound()

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Blog', url: blogAbsoluteUrl('/') },
          { name: category.title, url: blogAbsoluteUrl(`/categoria/${category.slug}`) },
        ])}
      />
      <BlogListing
        title={category.title}
        description={category.description}
        posts={pagination.items}
        page={pagination.page}
        totalPages={pagination.totalPages}
        basePath={`/categoria/${category.slug}`}
        emptyText="Ainda não há artigos publicados nesta categoria."
      />
    </>
  )
}

export function TagListing({ slug, page }: { slug: string; page: number }) {
  const tag = getBlogTag(slug)
  if (!tag) notFound()
  const pagination = paginatePosts(getPostsByTag(tag.slug), page, POSTS_PER_PAGE)
  if (page > 1 && page > pagination.totalPages) notFound()

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Blog', url: blogAbsoluteUrl('/') },
          { name: tag.title, url: blogAbsoluteUrl(`/tag/${tag.slug}`) },
        ])}
      />
      <BlogListing
        title={tag.title}
        description={tag.description}
        posts={pagination.items}
        page={pagination.page}
        totalPages={pagination.totalPages}
        basePath={`/tag/${tag.slug}`}
        emptyText="Ainda não há artigos com esta tag."
      />
    </>
  )
}
