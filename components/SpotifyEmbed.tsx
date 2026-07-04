'use client'

import { useEffect, useMemo, useState } from 'react'

interface SpotifyEmbedProps {
  embedCode: string
}

function getPlatformEmbedUrl(url: string): string | null {
  const trimmed = url.trim()

  // Só monta embed automaticamente quando o usuário colou a URL da faixa.
  // Se já veio um <iframe>, ele deve ser renderizado como está.
  if (/^https?:\/\/(www\.)?soundcloud\.com\//i.test(trimmed)) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`
  }

  return null
}

function mergeAllowAttribute(value: string): string {
  const requiredPermissions = ['autoplay', 'clipboard-write', 'encrypted-media', 'fullscreen', 'picture-in-picture']
  const permissions = new Set(
    value
      .split(';')
      .map((permission) => permission.trim())
      .filter(Boolean)
  )

  requiredPermissions.forEach((permission) => permissions.add(permission))
  return Array.from(permissions).join('; ')
}

function normalizeEmbedCode(embedCode: string): string {
  const trimmed = embedCode.trim()
  const platformEmbedUrl = getPlatformEmbedUrl(trimmed)

  let normalized = platformEmbedUrl
    ? `<iframe width="100%" height="450" scrolling="no" frameborder="no" src="${platformEmbedUrl}"></iframe>`
    : trimmed

  if (!/<iframe/i.test(normalized)) {
    return normalized
  }

  normalized = normalized.replace(/\sallow=(["'])(.*?)\1/i, (_match, quote, value) => {
    return ` allow=${quote}${mergeAllowAttribute(value)}${quote}`
  })

  if (!/\sallow=/i.test(normalized)) {
    normalized = normalized.replace(/<iframe/i, '<iframe allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"')
  }

  if (!/\sloading=/i.test(normalized)) {
    normalized = normalized.replace(/<iframe/i, '<iframe loading="lazy"')
  }

  if (!/\sreferrerpolicy=/i.test(normalized)) {
    normalized = normalized.replace(/<iframe/i, '<iframe referrerpolicy="strict-origin-when-cross-origin"')
  }

  return normalized
}

export default function SpotifyEmbed({ embedCode }: SpotifyEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const normalizedEmbedCode = useMemo(() => normalizeEmbedCode(embedCode), [embedCode])

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  if (!isLoaded) {
    return (
      <div className="w-full h-152 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Carregando player...</div>
      </div>
    )
  }

  return (
    <div
      className="w-full"
      dangerouslySetInnerHTML={{ __html: normalizedEmbedCode }}
    />
  )
}
