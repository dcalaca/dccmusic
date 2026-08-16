import Link from 'next/link'
import { blogHref } from '@/lib/blog/site'

type Crumb = {
  label: string
  href?: string
}

export default function BlogBreadcrumbs({ items, host }: { items: Crumb[]; host?: string | null }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-400">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span className="text-gray-600">/</span>}
              {item.href && !isLast ? (
                <Link href={blogHref(item.href, host)} className="hover:text-white transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-gray-200' : ''}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
