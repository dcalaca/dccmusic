import type { Metadata } from 'next'
import BlogListing from '@/components/blog/BlogListing'
import BlogSearchForm from '@/components/blog/BlogSearchForm'
import { paginatePosts, searchPosts } from '@/lib/blog/posts'
import { POSTS_PER_PAGE } from '@/lib/blog/site'

export const revalidate = 3600

type PageProps = {
  searchParams: { q?: string; page?: string }
}

export function generateMetadata({ searchParams }: PageProps): Metadata {
  const query = (searchParams.q || '').trim()
  return {
    title: query ? `Busca: ${query}` : 'Busca',
    description: 'Busque artigos do Blog DCC Music sobre criação musical, inteligência artificial, partitura e cifra.',
    alternates: { canonical: '/busca' },
    robots: { index: false, follow: true },
  }
}

export default function BlogSearchPage({ searchParams }: PageProps) {
  const query = (searchParams.q || '').trim()
  const page = Number(searchParams.page || '1') || 1
  const results = query ? searchPosts(query) : []
  const pagination = paginatePosts(results, page, POSTS_PER_PAGE)

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Busca</h1>
        <p className="mt-2 text-gray-400">Encontre artigos por tema, ferramenta ou dúvida.</p>
        <div className="mt-6 max-w-xl">
          <BlogSearchForm defaultValue={query} />
        </div>
      </div>
      {query ? (
        <BlogListing
          title={results.length ? `Resultados para “${query}”` : `Nenhum resultado para “${query}”`}
          description={
            results.length
              ? `${results.length} ${results.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}.`
              : 'Tente outro termo, uma categoria ou o nome de uma ferramenta da DCC Music.'
          }
          posts={pagination.items}
          page={pagination.page}
          totalPages={pagination.totalPages}
          basePath="/busca"
          emptyText=""
        />
      ) : (
        <p className="mx-auto max-w-5xl px-4 pb-16 pt-8 text-gray-500 sm:px-6 lg:px-8">Digite um termo para buscar artigos.</p>
      )}
    </div>
  )
}
