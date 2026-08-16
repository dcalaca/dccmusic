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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-gray-800 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black px-5 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Blog DCC Music</p>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl">
          Criação musical, inteligência artificial e as ferramentas da DCC Music
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-400">
          Conteúdo para compositores e artistas independentes: o que é a DCC Music, como criar músicas com IA, gerar partitura e cifra e divulgar o trabalho.
        </p>
        <div className="mt-4 max-w-xl">
          <BlogSearchForm />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white">Em destaque</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {featured.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Temas principais</h2>
        <p className="mt-1 text-sm text-gray-400">Páginas pilar e os assuntos que organizam o conteúdo do blog.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {blogClusters.map((cluster) => {
            const pillar = pillars.find((post) => post.slug === cluster.pillarSlug) || published.find((post) => post.cluster === cluster.slug)
            return (
              <article key={cluster.slug} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <h3 className="text-base font-bold text-white">{cluster.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{cluster.description}</p>
                {pillar && (
                  <Link href={blogHref(`/${pillar.slug}`)} className="mt-3 inline-block text-sm font-semibold text-purple-300 hover:text-white">
                    Ler {pillar.title}
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Categorias</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blogCategories.map((category) => {
            const count = published.filter((post) => post.category === category.slug).length
            return (
              <Link
                key={category.slug}
                href={blogHref(`/categoria/${category.slug}`)}
                className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 transition-colors hover:border-purple-500/40"
              >
                <h3 className="font-bold text-white">{category.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{category.description}</p>
                <p className="mt-2 text-xs text-gray-500">{count} {count === 1 ? 'artigo' : 'artigos'}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white">Artigos recentes</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recent.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      {studio && (
        <section className="mt-8 rounded-xl border border-purple-500/30 bg-purple-950/20 px-5 py-5">
          <h2 className="text-lg font-bold text-white">{studio.label}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-300">{studio.description}</p>
          <a
            href={siteHref(studio.path, undefined, { utm_source: 'blog', utm_medium: 'home', utm_campaign: 'blog-home', utm_content: 'studio-ia' })}
            className="mt-4 inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {studio.defaultCta}
          </a>
        </section>
      )}
    </div>
  )
}
