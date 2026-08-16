import Link from 'next/link'
import BlogPostCard from './BlogPostCard'
import BlogPagination from './BlogPagination'
import { blogHref } from '@/lib/blog/site'
import type { BlogPost } from '@/lib/blog/types'

export default function BlogListing({
  title,
  description,
  posts,
  page,
  totalPages,
  basePath,
  host,
  emptyText,
}: {
  title: string
  description: string
  posts: BlogPost[]
  page: number
  totalPages: number
  basePath: string
  host?: string | null
  emptyText: string
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs text-purple-300">
        <Link href={blogHref('/', host)} className="hover:text-white">
          Blog
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-400">{description}</p>

      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <BlogPostCard key={post.slug} post={post} host={host} />
          ))}
        </div>
      )}

      <BlogPagination page={page} totalPages={totalPages} basePath={basePath} host={host} />
    </div>
  )
}
