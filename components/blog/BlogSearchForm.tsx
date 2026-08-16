import { blogHref } from '@/lib/blog/site'

export default function BlogSearchForm({ defaultValue = '', className = '', host }: { defaultValue?: string; className?: string; host?: string | null }) {
  const action = blogHref('/busca', host)

  return (
    <form action={action} method="get" className={className} role="search">
      <label htmlFor="blog-search" className="sr-only">
        Buscar artigos
      </label>
      <div className="flex gap-2">
        <input
          id="blog-search"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Buscar artigos sobre música, IA, cifra..."
          className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white outline-none ring-purple-500 placeholder:text-gray-500 focus:ring-2"
        />
        <button type="submit" className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          Buscar
        </button>
      </div>
    </form>
  )
}
