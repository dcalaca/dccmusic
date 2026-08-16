import type { Metadata } from 'next'
import Link from 'next/link'
import BlogSearchForm from '@/components/blog/BlogSearchForm'
import BlogPostCard from '@/components/blog/BlogPostCard'
import { getFeaturedPosts, getPillarPosts, getPublishedPosts, getRecentPosts } from '@/lib/blog/posts'
import { blogCategories, blogClusters } from '@/lib/blog/taxonomy'
import { BLOG_DESCRIPTION, BLOG_TITLE, blogHref, siteHref } from '@/lib/blog/site'
import { getBlogProduct } from '@/lib/blog/products'

export const revalidate = 3600

export const metadata: Metadata = {
  title: { absolute: `${BLOG_TITLE} | Criação musical, IA, partitura e cifra` },
  description: BLOG_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    url: 'https://blog.dccmusic.online',
    type: 'website',
  },
}

export default function BlogHomePage() {
  const featured = getFeaturedPosts(3)
  const featuredSlugs = featured.map((post) => post.slug)
  const recent = getRecentPosts(6, featuredSlugs)
  const pillars = getPillarPosts()
  const published = getPublishedPosts()
  const studio = getBlogProduct('studio-ia')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black px-6 py-10 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-purple-300">Blog DCC Music</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">
          Criação musical, inteligência artificial e as ferramentas da DCC Music
        </h1>
        <p className="mt-4 max-w-2xl text-gray-300">
          Conteúdo para compositores e artistas independentes: o que é a DCC Music, como criar músicas com IA, gerar partitura e cifra e divulgar o trabalho.
        </p>
        <div className="mt-6 max-w-xl">
          <BlogSearchForm />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Em destaque</h2>
          <div className="mt-6 grid gap-6">
            {featured.map((post, index) => (
              <BlogPostCard key={post.slug} post={post} featured={index === 0} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Temas principais</h2>
        <p className="mt-2 text-gray-400">Páginas pilar e os assuntos que organizam o conteúdo do blog.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {blogClusters.map((cluster) => {
            const pillar = pillars.find((post) => post.slug === cluster.pillarSlug) || published.find((post) => post.cluster === cluster.slug)
            return (
              <article key={cluster.slug} className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                <h3 className="text-lg font-bold">{cluster.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{cluster.description}</p>
                {pillar && (
                  <Link href={blogHref(`/${pillar.slug}`)} className="mt-4 inline-block text-sm font-semibold text-purple-300 hover:text-white">
                    Ler {pillar.title}
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Categorias</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blogCategories.map((category) => {
            const count = published.filter((post) => post.category === category.slug).length
            return (
              <Link
                key={category.slug}
                href={blogHref(`/categoria/${category.slug}`)}
                className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5 transition-colors hover:border-purple-500/40"
              >
                <h3 className="font-bold">{category.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{category.description}</p>
                <p className="mt-3 text-xs text-gray-500">{count} {count === 1 ? 'artigo' : 'artigos'}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Artigos recentes</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recent.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      {studio && (
        <section className="mt-14 rounded-2xl border border-purple-500/30 bg-purple-950/20 px-6 py-8">
          <h2 className="text-2xl font-bold">{studio.label}</h2>
          <p className="mt-2 max-w-2xl text-gray-300">{studio.description}</p>
          <a
            href={siteHref(studio.path, undefined, { utm_source: 'blog', utm_medium: 'home', utm_campaign: 'blog-home', utm_content: 'studio-ia' })}
            className="mt-5 inline-flex rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {studio.defaultCta}
          </a>
        </section>
      )}
    </div>
  )
}
