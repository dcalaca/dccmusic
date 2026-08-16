import Link from 'next/link'
import Image from 'next/image'
import { blogHref } from '@/lib/blog/site'
import { formatDate } from '@/lib/utils'
import { getBlogCategory } from '@/lib/blog/taxonomy'
import type { BlogPost } from '@/lib/blog/types'

export default function BlogPostCard({
  post,
  host,
  featured = false,
}: {
  post: BlogPost
  host?: string | null
  featured?: boolean
}) {
  const category = getBlogCategory(post.category)

  return (
    <article
      className={`overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60 ${
        featured ? 'md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-stretch' : ''
      }`}
    >
      <Link
        href={blogHref(`/${post.slug}`, host)}
        className={`relative block overflow-hidden bg-black ${
          featured ? 'aspect-[2/1] md:aspect-auto md:min-h-[160px] md:h-full' : 'aspect-[2/1]'
        }`}
      >
        <Image
          src={post.featuredImage}
          alt={post.imageAlt}
          fill
          className="object-contain p-4"
          sizes={featured ? '(min-width: 768px) 40vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
        />
      </Link>
      <div className="p-4">
        {category && (
          <Link href={blogHref(`/categoria/${category.slug}`, host)} className="text-[11px] font-semibold uppercase tracking-wide text-purple-300 hover:text-white">
            {category.title}
          </Link>
        )}
        <h3 className={`mt-1 font-bold leading-snug text-white ${featured ? 'text-lg' : 'text-base'}`}>
          <Link href={blogHref(`/${post.slug}`, host)} className="hover:text-purple-200">
            {post.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-400">{post.excerpt}</p>
        <p className="mt-3 text-xs text-gray-500">
          {formatDate(post.publishedAt)} · {post.readingTimeMinutes} min de leitura
        </p>
      </div>
    </article>
  )
}
