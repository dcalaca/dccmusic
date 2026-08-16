import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { createBlogMdxComponents } from './mdx-components'

export default function ArticleBody({
  source,
  articleSlug,
  articleTitle,
  host,
}: {
  source: string
  articleSlug: string
  articleTitle: string
  host?: string | null
}) {
  return (
    <div className="blog-prose">
      <MDXRemote
        source={source}
        components={createBlogMdxComponents({ articleSlug, articleTitle, host })}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </div>
  )
}
