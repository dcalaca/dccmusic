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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm text-purple-300">
        <Link href={blogHref('/', host)} className="hover:text-white">
          Blog
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-gray-400">{description}</p>

      {posts.length === 0 ? (
        <p className="mt-10 text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <BlogPostCard key={post.slug} post={post} host={host} />
          ))}
        </div>
      )}

      <BlogPagination page={page} totalPages={totalPages} basePath={basePath} host={host} />
    </div>
  )
}
