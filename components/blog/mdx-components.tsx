import Image from 'next/image'
import Link from 'next/link'
import type { HTMLAttributes, ReactNode } from 'react'
import BlogCta from './BlogCta'
import {
  Callout,
  Comparison,
  Definition,
  DirectAnswer,
  Example,
  Faq,
  ProsCons,
  Steps,
} from './GeoBlocks'
import { BLOG_RESERVED_SLUGS, MAIN_SITE_PATH_PREFIXES, blogHref, siteHref } from '@/lib/blog/site'

function heading(Tag: 'h2' | 'h3' | 'h4') {
  return function Heading({
    id,
    children,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) {
    const className =
      Tag === 'h2'
        ? 'mt-10 mb-3 text-2xl font-bold text-white scroll-mt-24'
        : Tag === 'h3'
          ? 'mt-8 mb-2 text-xl font-semibold text-white scroll-mt-24'
          : 'mt-6 mb-2 text-lg font-semibold text-white scroll-mt-24'

    return (
      <Tag id={id} className={className} {...props}>
        {id ? (
          <a href={`#${id}`} className="hover:text-purple-200">
            {children}
          </a>
        ) : (
          children
        )}
      </Tag>
    )
  }
}

export function createBlogMdxComponents(options: {
  articleSlug: string
  articleTitle: string
  host?: string | null
}): Record<string, any> {
  const { articleSlug, articleTitle, host } = options

  return {
    h1: heading('h2'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    p: ({ children }: { children?: ReactNode }) => <p className="my-4 text-[1.05rem] leading-8 text-gray-200">{children}</p>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="my-4 list-disc space-y-2 pl-6 text-gray-200">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-gray-200">{children}</ol>,
    li: ({ children }: { children?: ReactNode }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="my-6 border-l-4 border-purple-500/50 bg-purple-950/10 py-2 pl-4 text-gray-300">
        {children}
      </blockquote>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm text-left">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => <thead className="bg-gray-900 text-gray-300">{children}</thead>,
    th: ({ children }: { children?: ReactNode }) => <th className="border border-gray-800 px-3 py-2 font-semibold">{children}</th>,
    td: ({ children }: { children?: ReactNode }) => <td className="border border-gray-800 px-3 py-2 text-gray-200">{children}</td>,
    a: ({ href = '', children }: { href?: string; children?: ReactNode }) => {
      const isExternal = /^https?:\/\//i.test(href)
      const isAnchor = href.startsWith('#')
      if (isAnchor) {
        return (
          <a href={href} className="text-purple-300 underline-offset-2 hover:text-white hover:underline">
            {children}
          </a>
        )
      }

      if (isExternal) {
        const isDcc = href.startsWith('https://www.dccmusic.online') || href.startsWith('https://blog.dccmusic.online')
        return (
          <a
            href={href}
            className="text-purple-300 underline-offset-2 hover:text-white hover:underline"
            {...(!isDcc ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {children}
          </a>
        )
      }

      const path = href.startsWith('/') ? href : `/${href}`
      const blogPrefixes = ['/categoria/', '/tag/', '/autor/', '/busca']
      const isMainSitePath = MAIN_SITE_PATH_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
      )
      const isBlogPath =
        path === '/' ||
        path === '/blog' ||
        path.startsWith('/blog/') ||
        blogPrefixes.some((prefix) => path.startsWith(prefix)) ||
        (!isMainSitePath && path.split('/').length === 2 && !(BLOG_RESERVED_SLUGS as readonly string[]).includes(path.slice(1)))

      if (isBlogPath) {
        const internal = path.replace(/^\/blog(?=\/|$)/, '') || '/'
        return (
          <Link href={blogHref(internal, host)} className="text-purple-300 underline-offset-2 hover:text-white hover:underline">
            {children}
          </Link>
        )
      }

      const productHref = siteHref(path, host, {
        utm_source: 'blog',
        utm_medium: 'content',
        utm_campaign: articleSlug,
      })

      if (productHref.startsWith('http')) {
        return (
          <a href={productHref} className="text-purple-300 underline-offset-2 hover:text-white hover:underline">
            {children}
          </a>
        )
      }

      return (
        <Link href={productHref} className="text-purple-300 underline-offset-2 hover:text-white hover:underline">
          {children}
        </Link>
      )
    },
    img: ({ src = '', alt = '', width, height }: { src?: string; alt?: string; width?: string | number; height?: string | number }) => {
      const w = Number(width) || 1200
      const h = Number(height) || 630
      return (
        <span className="my-6 block">
          <Image
            src={String(src)}
            alt={alt || ''}
            width={w}
            height={h}
            className="h-auto w-full rounded-xl"
            sizes="(min-width: 768px) 720px, 100vw"
            loading="lazy"
          />
        </span>
      )
    },
    Definition,
    DirectAnswer,
    Steps,
    ProsCons,
    Comparison,
    Example,
    Callout,
    Faq,
    Cta: (props: { product: string; title?: string; description?: string; label?: string }) => (
      <BlogCta
        {...props}
        articleSlug={articleSlug}
        articleTitle={articleTitle}
        host={host}
      />
    ),
  }
}
