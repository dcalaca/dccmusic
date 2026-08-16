import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TagListing } from '@/components/blog/TaxonomyListings'
import { getPostsByTag, paginatePosts } from '@/lib/blog/posts'
import { POSTS_PER_PAGE } from '@/lib/blog/site'
import { getBlogTag } from '@/lib/blog/taxonomy'

export const revalidate = 3600

type PageProps = {
  params: { slug: string; page: string }
}

export function generateMetadata({ params }: PageProps): Metadata {
  const tag = getBlogTag(params.slug)
  const page = Number(params.page)
  if (!tag || !Number.isInteger(page) || page < 2) {
    return { robots: { index: false, follow: false } }
  }
  return {
    title: `${tag.title} · página ${page}`,
    description: tag.description,
    alternates: { canonical: `/tag/${tag.slug}/pagina/${page}` },
    robots: { index: false, follow: true },
  }
}

export default function BlogTagPagedPage({ params }: PageProps) {
  const page = Number(params.page)
  if (!Number.isInteger(page) || page < 2) notFound()
  const tag = getBlogTag(params.slug)
  if (!tag) notFound()
  const pagination = paginatePosts(getPostsByTag(tag.slug), page, POSTS_PER_PAGE)
  if (page > pagination.totalPages) notFound()
  return <TagListing slug={params.slug} page={page} />
}
