import GithubSlugger from 'github-slugger'
import type { TocItem } from './types'

export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let inCode = false

  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue

    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue

    const text = match[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim()

    items.push({
      level: match[1].length as 2 | 3,
      text,
      id: slugger.slug(text),
    })
  }

  return items
}

export function readingTimeMinutes(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`\[\]()]/g, ' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
