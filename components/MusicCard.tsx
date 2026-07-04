'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FiMusic, FiExternalLink, FiEye } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import { canFetchMusicImage, isSpotifyUrl } from '@/lib/spotify-utils'
import { formatDateShort, formatIntegerPtBR } from '@/lib/utils'

interface MusicCardProps {
  music: {
    id: string
    title: string
    slug: string
    genre?: string | null
    spotifyUrl?: string | null
    coverUrl?: string | null
    href?: string
    sourceLabel?: string | null
    publishedAt: Date
    viewCount?: number
  }
  view?: 'lista' | 'grid'
}

export default function MusicCard({ music, view = 'lista' }: MusicCardProps) {
  const hasSpotify = isSpotifyUrl(music.spotifyUrl)
  const href = music.href || `/musicas/${music.slug}`
  const canLoadPlatformImage = canFetchMusicImage(music.spotifyUrl)
  const [imageUrl, setImageUrl] = useState<string | null>(music.coverUrl || null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [hasTriedLoadingImage, setHasTriedLoadingImage] = useState(false)
  const [formattedDate, setFormattedDate] = useState<string>('')
  const [formattedViews, setFormattedViews] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const viewCount = music.viewCount ?? 0
  
  useEffect(() => {
    // Marcar como montado apenas no cliente para evitar hydration mismatch
    setMounted(true)
  }, [])

  useEffect(() => {
    // Formatar data apenas no cliente após montagem para evitar problemas de hidratação
    if (!mounted) return
    
    setFormattedDate(formatDateShort(music.publishedAt))
    if (viewCount > 0) {
      setFormattedViews(formatIntegerPtBR(viewCount))
    }
  }, [music.publishedAt, viewCount, mounted])

  useEffect(() => {
    // Buscar capa automática apenas para plataformas com oEmbed suportado.
    if (!imageUrl && canLoadPlatformImage && !loadingImage && !hasTriedLoadingImage) {
      setHasTriedLoadingImage(true)
      setLoadingImage(true)
      // Usar a API route que criamos para evitar problemas de CORS
      fetch(`/api/spotify/image?url=${encodeURIComponent(music.spotifyUrl || '')}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.imageUrl) {
            setImageUrl(data.imageUrl)
          }
        })
        .catch(() => {
          // Ignorar erros silenciosamente
        })
        .finally(() => {
          setLoadingImage(false)
        })
    }
  }, [imageUrl, canLoadPlatformImage, music.spotifyUrl, loadingImage, hasTriedLoadingImage])

  if (view === 'lista') {
    return (
      <Link href={href}>
        <div className="group relative overflow-hidden rounded-lg bg-gray-900 border border-gray-800 hover:border-primary-500 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {imageUrl ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800">
                    <Image
                      src={imageUrl}
                      alt={music.title}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary-600/20 group-hover:bg-primary-600/40 flex items-center justify-center transition-colors">
                    <FiMusic className="w-8 h-8 text-primary-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors truncate">
                  {music.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {music.genre && (
                    <span className="px-2 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800">
                      {music.genre}
                    </span>
                  )}
                  <span>{mounted ? formattedDate : formatDateShort(music.publishedAt)}</span>
                  {hasSpotify && (
                    <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 border border-green-800">
                      Spotify
                    </span>
                  )}
                  {music.sourceLabel && (
                    <span className="px-2 py-1 rounded bg-purple-900/50 text-purple-200 border border-purple-800">
                      {music.sourceLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {viewCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <FiEye className="w-3.5 h-3.5" />
                <span>
                  {mounted ? formattedViews : formatIntegerPtBR(viewCount)} visualizações
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // Layout Grid
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-lg bg-gray-900 border border-gray-800 hover:border-primary-500 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20">
        {imageUrl ? (
          <div className="relative aspect-square w-full overflow-hidden">
            <Image
              src={imageUrl}
              alt={music.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="mb-2">
                {music.genre && (
                  <span className="text-xs px-2 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800">
                    {music.genre}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors line-clamp-2">
                {music.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300">
                <span>{mounted ? formattedDate : formatDateShort(music.publishedAt)}</span>
                {hasSpotify && (
                  <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 border border-green-800">
                    Spotify
                  </span>
                )}
                {music.sourceLabel && (
                  <span className="px-2 py-1 rounded bg-purple-900/50 text-purple-200 border border-purple-800">
                    {music.sourceLabel}
                  </span>
                )}
                {viewCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FiEye className="w-3.5 h-3.5" />
                    {mounted ? formattedViews : formatIntegerPtBR(viewCount)} visualizações
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-3">
              <div className="w-full h-24 sm:h-28 rounded-lg bg-primary-600/20 group-hover:bg-primary-600/40 flex items-center justify-center transition-colors">
                <FiMusic className="w-8 h-8 text-primary-400" />
              </div>
            </div>
            <div className="mb-2">
              {music.genre && (
                <span className="text-xs px-2 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800">
                  {music.genre}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors line-clamp-2">
              {music.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>{mounted ? formattedDate : formatDateShort(music.publishedAt)}</span>
              {hasSpotify && (
                <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 border border-green-800">
                  Spotify
                </span>
              )}
              {music.sourceLabel && (
                <span className="px-2 py-1 rounded bg-purple-900/50 text-purple-200 border border-purple-800">
                  {music.sourceLabel}
                </span>
              )}
              {viewCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <FiEye className="w-3.5 h-3.5" />
                  {mounted ? formattedViews : formatIntegerPtBR(viewCount)} visualizações
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
