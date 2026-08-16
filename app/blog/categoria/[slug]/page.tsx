import type { Metadata } from 'next'
import { CategoryListing } from '@/components/blog/TaxonomyListings'
import { getPostsByCategory } from '@/lib/blog/posts'
import { blogCategories, getBlogCategory } from '@/lib/blog/taxonomy'

export const revalidate = 3600

type PageProps = {
  params: { slug: string }
}

export function generateStaticParams() {
  return blogCategories.map((category) => ({ slug: category.slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const category = getBlogCategory(params.slug)
  if (!category) return { title: 'Categoria não encontrada', robots: { index: false, follow: false } }
  const posts = getPostsByCategory(category.slug)
  return {
    title: category.seoTitle || category.title,
    description: category.seoDescription || category.description,
    alternates: { canonical: `/categoria/${category.slug}` },
    robots: { index: posts.length > 0, follow: true },
  }
}

export default function BlogCategoryPage({ params }: PageProps) {
  return <CategoryListing slug={params.slug} page={1} />
}
