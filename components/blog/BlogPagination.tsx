import Link from 'next/link'
import { blogHref } from '@/lib/blog/site'

export default function BlogPagination({
  page,
  totalPages,
  basePath,
  host,
}: {
  page: number
  totalPages: number
  basePath: string
  host?: string | null
}) {
  if (totalPages <= 1) return null

  const hrefFor = (target: number) => {
    if (target <= 1) return blogHref(basePath, host)
    return blogHref(`${basePath}/pagina/${target}`, host)
  }

  return (
    <nav aria-label="Paginação" className="mt-10 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="rounded-lg border border-gray-800 px-4 py-2 text-gray-300 hover:text-white" rel="prev">
          Anterior
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-900 px-4 py-2 text-gray-600">Anterior</span>
      )}
      <span className="text-gray-400">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="rounded-lg border border-gray-800 px-4 py-2 text-gray-300 hover:text-white" rel="next">
          Próxima
        </Link>
      ) : (
        <span className="rounded-lg border border-gray-900 px-4 py-2 text-gray-600">Próxima</span>
      )}
    </nav>
  )
}
