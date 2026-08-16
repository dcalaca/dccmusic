import type { TocItem } from '@/lib/blog/types'

export default function ArticleToc({ items }: { items: TocItem[] }) {
  if (!items.length) return null

  return (
    <nav aria-label="Sumário" className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Neste artigo</p>
      <ol className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-3' : ''}>
            <a href={`#${item.id}`} className="text-gray-300 hover:text-white">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
