'use client'

import { useEffect } from 'react'

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function safePart(value: string) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function projectTitleFromPage() {
  const pathname = window.location.pathname

  if (pathname.includes('/studio-ia/playback')) {
    const versionCard = Array.from(document.querySelectorAll('p')).find((item) =>
      /^Versão\s+\d+/i.test(item.textContent?.trim() || '')
    )
    const card = versionCard?.closest('div.rounded-2xl') || versionCard?.parentElement?.parentElement
    const heading = card?.querySelector('h2')
    const value = safePart(heading?.textContent || '')
    if (value) return value
  }

  const headings = Array.from(document.querySelectorAll('h1, h2'))
  const ignored = new Set([
    'DCC Studio IA',
    'Criar Playback',
    'Meus Projetos',
    'Studio IA',
  ])
  for (const heading of headings) {
    const value = safePart(heading.textContent || '')
    if (value && !ignored.has(value) && value.length <= 120) return value
  }

  return ''
}

function versionFromName(value: string) {
  const text = safePart(value)
  const explicit = text.match(/(?:vers[aã]o|vs|musica gerada|música gerada)[\s#_-]*(\d+)/i)
  if (explicit?.[1]) return Number(explicit[1])
  return 0
}

function versionFromPage() {
  const candidates = Array.from(document.querySelectorAll('p, span, h3'))
    .map((item) => safePart(item.textContent || ''))
    .filter(Boolean)

  for (const text of candidates) {
    const match = text.match(/\bVersão\s+(\d+)\b/i)
    if (match) return Number(match[1])
  }
  return 0
}

function friendlyFilename(currentName: string) {
  const raw = safePart(currentName || 'musica.mp3')
  const extensionMatch = raw.match(/(\.[a-z0-9]{2,5})$/i)
  const extension = extensionMatch?.[1] || '.mp3'
  const base = safePart(raw.replace(/\.[a-z0-9]{2,5}$/i, ''))
  const title = projectTitleFromPage()
  const version = versionFromName(base) || versionFromPage()

  const lower = base.toLowerCase()
  const isPlayback = lower.includes('playback') || lower.includes('instrumental')
  const isVocal = lower.includes('voz') || lower.includes('vocal')
  const suffix = isPlayback ? 'Playback' : isVocal ? 'Voz' : ''

  const parts: string[] = []
  if (title) parts.push(title)
  if (version) parts.push(`vs ${version}`)
  if (suffix) parts.push(suffix)

  if (parts.length === 0) return `${base || 'Música'}${extension}`
  return `${parts.join(' - ')}${extension}`
}

async function proxyDownload(url: string) {
  const token = localStorage.getItem('composer_token')
  if (!token) throw new Error('Sessão expirada')

  const response = await fetch('/api/compositores/studio/download-proxy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error('download_failed')
  return response
}

export default function FriendlyAudioDownloads() {
  useEffect(() => {
    const originalAnchorClick = HTMLAnchorElement.prototype.click

    HTMLAnchorElement.prototype.click = function patchedClick() {
      if (this.download && this.href.startsWith('blob:') && /\.mp3$/i.test(this.download)) {
        this.download = friendlyFilename(this.download)
      }
      return originalAnchorClick.call(this)
    }

    const handleDownloadClick = async (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[download]') as HTMLAnchorElement | null
      if (!anchor || !anchor.href || !isHttpUrl(anchor.href)) return

      let source: URL
      try {
        source = new URL(anchor.href)
      } catch {
        return
      }
      if (source.origin === window.location.origin) return

      event.preventDefault()
      event.stopPropagation()

      const originalText = anchor.textContent
      anchor.style.pointerEvents = 'none'
      anchor.setAttribute('aria-busy', 'true')

      try {
        const response = await proxyDownload(anchor.href)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = friendlyFilename(anchor.download || 'musica.mp3')
        document.body.appendChild(link)
        originalAnchorClick.call(link)
        link.remove()
        // Mantém o blob disponível enquanto o Safari/iOS finaliza a gravação do arquivo.
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      } catch {
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
      } finally {
        anchor.style.pointerEvents = ''
        anchor.removeAttribute('aria-busy')
        if (originalText && !anchor.textContent) anchor.textContent = originalText
      }
    }

    document.addEventListener('click', handleDownloadClick, true)

    return () => {
      HTMLAnchorElement.prototype.click = originalAnchorClick
      document.removeEventListener('click', handleDownloadClick, true)
    }
  }, [])

  return null
}
