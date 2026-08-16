'use client'

import { useEffect, useState } from 'react'
import { FiCheck, FiCopy, FiFacebook, FiShare2 } from 'react-icons/fi'
import { pushGtmEvent } from '@/components/GtmEvents'

export default function ShareButtons({
  url,
  title,
  articleSlug,
}: {
  url: string
  title: string
  articleSlug: string
}) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function')
  }, [])
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const track = (channel: string) => {
    pushGtmEvent('dcc_blog_share', {
      content_type: 'blog_article',
      blog_article: articleSlug,
      share_channel: channel,
    })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      track('copy')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      track('copy_failed')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Compartilhar</span>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('whatsapp')}
        className="rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300 hover:text-white"
      >
        WhatsApp
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('twitter')}
        className="rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300 hover:text-white"
      >
        X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('facebook')}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300 hover:text-white"
      >
        <FiFacebook className="h-3.5 w-3.5" />
        Facebook
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300 hover:text-white"
      >
        {copied ? <FiCheck className="h-3.5 w-3.5" /> : <FiCopy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar link'}
      </button>
      {canNativeShare ? (
        <button
          type="button"
          onClick={() => {
            track('native')
            navigator.share({ title, url }).catch(() => null)
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300 hover:text-white"
        >
          <FiShare2 className="h-3.5 w-3.5" />
          Compartilhar
        </button>
      ) : null}
    </div>
  )
}
