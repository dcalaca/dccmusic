import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import BlogListing from '@/components/blog/BlogListing'
import JsonLd from '@/components/blog/JsonLd'
import { blogAuthors } from '@/lib/blog/authors'
import { getPostsByAuthor, getUsedAuthors, paginatePosts } from '@/lib/blog/posts'
import { breadcrumbSchema } from '@/lib/blog/schema'
import { blogAbsoluteUrl, POSTS_PER_PAGE, SITE_URL } from '@/lib/blog/site'

export const revalidate = 3600

type PageProps = {
  params: { slug: string }
}

export function generateStaticParams() {
  const used = getUsedAuthors()
  const slugs = used.length ? used : blogAuthors.map((author) => author.slug)
  return slugs.map((slug) => ({ slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const author = blogAuthors.find((item) => item.slug === params.slug)
  if (!author) return { title: 'Autor não encontrado', robots: { index: false, follow: false } }
  return {
    title: author.name,
    description: author.bio,
    alternates: { canonical: `/autor/${author.slug}` },
  }
}

export default function BlogAuthorPage({ params }: PageProps) {
  const author = blogAuthors.find((item) => item.slug === params.slug)
  if (!author) notFound()

  const pagination = paginatePosts(getPostsByAuthor(author.slug), 1, POSTS_PER_PAGE)
  const image = author.image.startsWith('http') ? author.image : `${SITE_URL}${author.image}`

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Blog', url: blogAbsoluteUrl('/') },
            { name: author.name, url: blogAbsoluteUrl(`/autor/${author.slug}`) },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: author.name,
            url: blogAbsoluteUrl(`/autor/${author.slug}`),
            mainEntity: {
              '@type': 'Person',
              name: author.name,
              description: author.bio,
              image,
              jobTitle: author.role,
            },
          },
        ]}
      />
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image src={author.image} alt={author.imageAlt} width={56} height={56} className="h-12 w-12 rounded-full object-cover" />
          <div>
            <p className="text-xs text-purple-300">{author.role}</p>
            <h1 className="text-2xl font-bold text-white">{author.name}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-gray-400">{author.bio}</p>
      </div>
      <BlogListing
        title="Artigos"
        description={`Conteúdos publicados por ${author.name}.`}
        posts={pagination.items}
        page={pagination.page}
        totalPages={pagination.totalPages}
        basePath={`/autor/${author.slug}`}
        emptyText="Este autor ainda não tem artigos publicados."
      />
    </>
  )
}
