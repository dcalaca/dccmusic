import Link from 'next/link'
import { blogHref } from '@/lib/blog/site'

export default function BlogNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-white">Artigo não encontrado</h1>
      <p className="mt-2 text-sm text-gray-400">
        Este conteúdo foi removido, ainda não foi publicado ou o endereço mudou.
      </p>
      <Link href={blogHref('/')} className="mt-5 inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
        Voltar ao blog
      </Link>
    </div>
  )
}
