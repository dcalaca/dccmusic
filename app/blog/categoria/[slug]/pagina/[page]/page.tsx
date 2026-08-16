import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CategoryListing } from '@/components/blog/TaxonomyListings'
import { getPostsByCategory, paginatePosts } from '@/lib/blog/posts'
import { POSTS_PER_PAGE } from '@/lib/blog/site'
import { getBlogCategory } from '@/lib/blog/taxonomy'

export const revalidate = 3600

type PageProps = {
  params: { slug: string; page: string }
}

export function generateStaticParams() {
  return []
}

export function generateMetadata({ params }: PageProps): Metadata {
  const category = getBlogCategory(params.slug)
  const page = Number(params.page)
  if (!category || !Number.isInteger(page) || page < 2) {
    return { robots: { index: false, follow: false } }
  }
  return {
    title: `${category.title} · página ${page}`,
    description: category.seoDescription || category.description,
    alternates: { canonical: `/categoria/${category.slug}/pagina/${page}` },
    robots: { index: false, follow: true },
  }
}

export default function BlogCategoryPagedPage({ params }: PageProps) {
  const page = Number(params.page)
  if (!Number.isInteger(page) || page < 2) notFound()
  const category = getBlogCategory(params.slug)
  if (!category) notFound()
  const pagination = paginatePosts(getPostsByCategory(category.slug), page, POSTS_PER_PAGE)
  if (page > pagination.totalPages) notFound()
  return <CategoryListing slug={params.slug} page={page} />
}
