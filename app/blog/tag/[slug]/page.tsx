import type { Metadata } from 'next'
import { TagListing } from '@/components/blog/TaxonomyListings'
import { getPostsByTag } from '@/lib/blog/posts'
import { blogTags, getBlogTag } from '@/lib/blog/taxonomy'

export const revalidate = 3600

type PageProps = {
  params: { slug: string }
}

export function generateStaticParams() {
  return blogTags.map((tag) => ({ slug: tag.slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const tag = getBlogTag(params.slug)
  if (!tag) return { title: 'Tag não encontrada', robots: { index: false, follow: false } }
  const posts = getPostsByTag(tag.slug)
  return {
    title: tag.title,
    description: tag.description,
    alternates: { canonical: `/tag/${tag.slug}` },
    robots: { index: posts.length > 0, follow: true },
  }
}

export default function BlogTagPage({ params }: PageProps) {
  return <TagListing slug={params.slug} page={1} />
}
