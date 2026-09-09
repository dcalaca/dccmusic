'use client'

import { useEffect } from 'react'

let prepareNextMp3Download = false
let prepareResetTimer: number | null = null

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

function publicationFilename(currentName: string) {
  const friendly = friendlyFilename(currentName)
  return friendly.replace(/\.mp3$/i, ' - para publicação.mp3')
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  if (offset < 0 || offset + value.length > bytes.length) return false
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

function synchsafeSize(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  )
}

function littleEndianUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

async function stripMp3Metadata(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let start = 0
  let end = bytes.length

  if (bytes.length >= 10 && hasAscii(bytes, 0, 'ID3')) {
    const payloadSize = synchsafeSize(bytes, 6)
    const hasFooter = Boolean(bytes[5] & 0x10)
    start = Math.min(bytes.length, 10 + payloadSize + (hasFooter ? 10 : 0))
  }

  if (end - start >= 128 && hasAscii(bytes, end - 128, 'TAG')) {
    end -= 128
  }

  if (end - start >= 32 && hasAscii(bytes, end - 32, 'APETAGEX')) {
    const apeSize = littleEndianUint32(bytes, end - 20)
    if (apeSize >= 32 && apeSize <= end - start) {
      end -= apeSize
    }
  }

  if (start >= end) throw new Error('invalid_mp3')
  return new Blob([bytes.slice(start, end)], { type: 'audio/mpeg' })
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

function armPublicationDownload() {
  prepareNextMp3Download = true
  if (prepareResetTimer) window.clearTimeout(prepareResetTimer)
  prepareResetTimer = window.setTimeout(() => {
    prepareNextMp3Download = false
    prepareResetTimer = null
  }, 30_000)
}

function clearPublicationDownload() {
  prepareNextMp3Download = false
  if (prepareResetTimer) {
    window.clearTimeout(prepareResetTimer)
    prepareResetTimer = null
  }
}

export default function FriendlyAudioDownloads() {
  useEffect(() => {
    const originalAnchorClick = HTMLAnchorElement.prototype.click

    HTMLAnchorElement.prototype.click = function patchedClick() {
      if (this.download && this.href.startsWith('blob:') && /\.mp3$/i.test(this.download)) {
        const nextName = friendlyFilename(this.download)

        if (prepareNextMp3Download) {
          clearPublicationDownload()
          const sourceUrl = this.href
          void (async () => {
            try {
              const response = await fetch(sourceUrl)
              if (!response.ok) throw new Error('blob_read_failed')
              const cleanBlob = await stripMp3Metadata(await response.blob())
              const cleanUrl = URL.createObjectURL(cleanBlob)
              const cleanLink = document.createElement('a')
              cleanLink.href = cleanUrl
              cleanLink.download = publicationFilename(nextName)
              document.body.appendChild(cleanLink)
              originalAnchorClick.call(cleanLink)
              cleanLink.remove()
              window.setTimeout(() => URL.revokeObjectURL(cleanUrl), 60_000)
              window.dispatchEvent(new CustomEvent('dcc-publication-download-finished'))
            } catch {
              window.dispatchEvent(new CustomEvent('dcc-publication-download-failed'))
            }
          })()
          return
        }

        this.download = nextName
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

    const addPublicationButtons = () => {
      if (!window.location.pathname.includes('/studio-ia/projetos/')) return

      const downloadButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[aria-label="Baixar música"]')
      )

      for (const downloadButton of downloadButtons) {
        const player = downloadButton.closest('div.rounded-2xl') as HTMLElement | null
        if (!player || player.querySelector('[data-dcc-publication-action]')) continue

        const wrapper = document.createElement('div')
        wrapper.dataset.dccPublicationAction = 'true'
        wrapper.className = 'mt-3 flex flex-col gap-1 border-t border-gray-800 pt-3 sm:flex-row sm:items-center sm:justify-between'

        const helper = document.createElement('span')
        helper.className = 'text-xs text-gray-500'
        helper.textContent = 'Baixa uma cópia sem metadados técnicos. O áudio original não é alterado.'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-600/60 bg-primary-950/40 px-3 py-2 text-xs font-bold text-primary-200 transition hover:border-primary-400 hover:text-white disabled:cursor-wait disabled:opacity-60'
        button.textContent = 'Preparar para publicação'
        button.setAttribute('aria-label', 'Preparar música para publicação no YouTube ou distribuidoras')

        button.addEventListener('click', () => {
          if (button.disabled) return
          button.disabled = true
          button.textContent = 'Preparando...'
          armPublicationDownload()
          downloadButton.click()

          window.setTimeout(() => {
            if (!button.isConnected) return
            button.disabled = false
            button.textContent = 'Preparar para publicação'
          }, 8_000)
        })

        wrapper.appendChild(helper)
        wrapper.appendChild(button)
        player.appendChild(wrapper)
      }
    }

    const handlePublicationFinished = () => {
      document.querySelectorAll<HTMLButtonElement>('[data-dcc-publication-action] button').forEach((button) => {
        button.disabled = false
        button.textContent = 'Preparar para publicação'
      })
    }

    const handlePublicationFailed = () => {
      clearPublicationDownload()
      document.querySelectorAll<HTMLButtonElement>('[data-dcc-publication-action] button').forEach((button) => {
        button.disabled = false
        button.textContent = 'Tentar novamente'
      })
    }

    document.addEventListener('click', handleDownloadClick, true)
    window.addEventListener('dcc-publication-download-finished', handlePublicationFinished)
    window.addEventListener('dcc-publication-download-failed', handlePublicationFailed)

    addPublicationButtons()
    const observer = new MutationObserver(addPublicationButtons)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearPublicationDownload()
      observer.disconnect()
      HTMLAnchorElement.prototype.click = originalAnchorClick
      document.removeEventListener('click', handleDownloadClick, true)
      window.removeEventListener('dcc-publication-download-finished', handlePublicationFinished)
      window.removeEventListener('dcc-publication-download-failed', handlePublicationFailed)
    }
  }, [])

  return null
}
