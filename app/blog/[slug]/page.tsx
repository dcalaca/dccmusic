import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { Suspense } from 'react'
import ArticleBody from '@/components/blog/ArticleBody'
import ArticleToc from '@/components/blog/ArticleToc'
import BlogAnalytics from '@/components/blog/BlogAnalytics'
import BlogBreadcrumbs from '@/components/blog/BlogBreadcrumbs'
import BlogPostCard from '@/components/blog/BlogPostCard'
import JsonLd from '@/components/blog/JsonLd'
import ShareButtons from '@/components/blog/ShareButtons'
import { Faq } from '@/components/blog/GeoBlocks'
import { getBlogAuthor } from '@/lib/blog/authors'
import { extractToc } from '@/lib/blog/markdown'
import { getPublishedPosts, getRelatedPosts, resolvePostRoute } from '@/lib/blog/posts'
import { articleJsonLd, breadcrumbSchema } from '@/lib/blog/schema'
import { blogAbsoluteUrl, blogHref } from '@/lib/blog/site'
import { getBlogCategory, getBlogCluster, getBlogTag } from '@/lib/blog/taxonomy'
import { formatDate } from '@/lib/utils'

export const revalidate = 3600

type PageProps = {
  params: { slug: string }
}

export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const resolved = resolvePostRoute(params.slug)
  if (resolved.type === 'redirect') {
    return { robots: { index: false, follow: true } }
  }
  if (resolved.type !== 'post') {
    return { title: 'Artigo não encontrado', robots: { index: false, follow: false } }
  }

  const post = resolved.post
  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.description
  const canonical = post.canonical || blogAbsoluteUrl(`/${post.slug}`)
  const image = post.featuredImage.startsWith('http') ? post.featuredImage : `https://www.dccmusic.online${post.featuredImage}`

  return {
    title,
    description,
    authors: [{ name: getBlogAuthor(post.author).name }],
    alternates: { canonical },
    robots: {
      index: !post.noindex,
      follow: true,
    },
    openGraph: {
      type: 'article',
      locale: 'pt_BR',
      url: canonical,
      siteName: 'Blog DCC Music',
      title,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [getBlogAuthor(post.author).name],
      images: [
        {
          url: image,
          width: post.imageWidth,
          height: post.imageHeight,
          alt: post.imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default function BlogArticlePage({ params }: PageProps) {
  const resolved = resolvePostRoute(params.slug)
  if (resolved.type === 'redirect') {
    permanentRedirect(blogHref(`/${resolved.to}`))
  }
  if (resolved.type !== 'post') {
    notFound()
  }

  const post = resolved.post
  const author = getBlogAuthor(post.author)
  const category = getBlogCategory(post.category)
  const cluster = getBlogCluster(post.cluster)
  const related = getRelatedPosts(post, 3)
  const toc = extractToc(post.content)
  const canonical = post.canonical || blogAbsoluteUrl(`/${post.slug}`)
  const updated = post.updatedAt && post.updatedAt !== post.publishedAt

  const crumbs = [
    { label: 'Blog', href: '/' },
    ...(category ? [{ label: category.title, href: `/categoria/${category.slug}` }] : []),
    { label: post.title },
  ]

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd
        data={[
          ...articleJsonLd(post),
          breadcrumbSchema(
            crumbs
              .filter((item) => item.label)
              .map((item) => ({
                name: item.label,
                url: item.href ? blogAbsoluteUrl(item.href) : canonical,
              }))
          ),
        ]}
      />
      <Suspense fallback={null}>
        <BlogAnalytics
          articleSlug={post.slug}
          articleTitle={post.title}
          category={post.category}
          cluster={post.cluster}
        />
      </Suspense>

      <BlogBreadcrumbs items={crumbs} />

      <header className="mx-auto mt-6 max-w-3xl">
        {category && (
          <Link href={blogHref(`/categoria/${category.slug}`)} className="text-sm font-semibold uppercase tracking-wide text-purple-300 hover:text-white">
            {category.title}
          </Link>
        )}
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg text-gray-300">{post.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
          <Link href={blogHref(`/autor/${author.slug}`)} className="hover:text-white">
            {author.name}
          </Link>
          <time dateTime={post.publishedAt}>Publicado em {formatDate(post.publishedAt)}</time>
          {updated && <time dateTime={post.updatedAt}>Atualizado em {formatDate(post.updatedAt)}</time>}
          <span>{post.readingTimeMinutes} min de leitura</span>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-gray-800">
        <Image
          src={post.featuredImage}
          alt={post.imageAlt}
          width={post.imageWidth}
          height={post.imageHeight}
          className="h-auto w-full object-cover"
          sizes="(min-width: 768px) 768px, 100vw"
          priority
        />
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,48rem)_16rem] lg:justify-center">
        <div className="min-w-0">
          <div className="mb-8 lg:hidden">
            <ArticleToc items={toc} />
          </div>
          <ArticleBody source={post.content} articleSlug={post.slug} articleTitle={post.title} />
          {post.faq.length > 0 && <Faq items={post.faq} />}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <ArticleToc items={toc} />
            {cluster && (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Tema</p>
                <p className="mt-2 font-semibold text-white">{cluster.title}</p>
                <p className="mt-2 text-gray-400">{cluster.description}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="mx-auto mt-10 max-w-3xl space-y-6">
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tagSlug) => {
            const tag = getBlogTag(tagSlug)
            if (!tag) return null
            return (
              <Link
                key={tag.slug}
                href={blogHref(`/tag/${tag.slug}`)}
                className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-300 hover:text-white"
              >
                {tag.title}
              </Link>
            )
          })}
        </div>
        <ShareButtons url={canonical} title={post.title} articleSlug={post.slug} />
        <p className="text-sm text-gray-500">
          Escrito por{' '}
          <Link href={blogHref(`/autor/${author.slug}`)} className="text-gray-300 hover:text-white">
            {author.name}
          </Link>
          . {author.bio}
        </p>
      </footer>

      {related.length > 0 && (
        <section className="mx-auto mt-14 max-w-5xl">
          <h2 className="text-2xl font-bold">Artigos relacionados</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {related.map((item) => (
              <BlogPostCard key={item.slug} post={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
