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
    <article className={`overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/60 ${featured ? 'md:grid md:grid-cols-[1.1fr_1fr]' : ''}`}>
      <Link href={blogHref(`/${post.slug}`, host)} className="block relative bg-gray-900">
        <Image
          src={post.featuredImage}
          alt={post.imageAlt}
          width={post.imageWidth}
          height={post.imageHeight}
          className={`w-full object-cover ${featured ? 'h-56 md:h-full' : 'h-44'}`}
          sizes={featured ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
        />
      </Link>
      <div className="p-5">
        {category && (
          <Link href={blogHref(`/categoria/${category.slug}`, host)} className="text-xs font-semibold uppercase tracking-wide text-purple-300 hover:text-white">
            {category.title}
          </Link>
        )}
        <h3 className={`mt-2 font-bold leading-snug ${featured ? 'text-2xl' : 'text-lg'}`}>
          <Link href={blogHref(`/${post.slug}`, host)} className="hover:text-purple-200">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-gray-400 line-clamp-3">{post.excerpt}</p>
        <p className="mt-4 text-xs text-gray-500">
          {formatDate(post.publishedAt)} · {post.readingTimeMinutes} min de leitura
        </p>
      </div>
    </article>
  )
}
