import Link from 'next/link'
import { blogHref } from '@/lib/blog/site'
import { formatDate } from '@/lib/utils'
import { getBlogCategory } from '@/lib/blog/taxonomy'
import type { BlogPost } from '@/lib/blog/types'

export default function BlogPostCard({
  post,
  host,
}: {
  post: BlogPost
  host?: string | null
}) {
  const category = getBlogCategory(post.category)

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
      {category && (
        <Link href={blogHref(`/categoria/${category.slug}`, host)} className="text-[11px] font-semibold uppercase tracking-wide text-purple-300 hover:text-white">
          {category.title}
        </Link>
      )}
      <h3 className="mt-1 text-base font-bold leading-snug text-white">
        <Link href={blogHref(`/${post.slug}`, host)} className="hover:text-purple-200">
          {post.title}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-gray-400">{post.excerpt}</p>
      <p className="mt-2 text-xs text-gray-500">
        {formatDate(post.publishedAt)} · {post.readingTimeMinutes} min de leitura
      </p>
    </article>
  )
}
