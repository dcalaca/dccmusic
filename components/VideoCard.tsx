'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FiPlay, FiClock } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import { formatDateShort, formatIntegerPtBR } from '@/lib/utils'

interface VideoCardProps {
  video: {
    id: string
    title: string
    slug: string
    thumbnailUrl?: string | null
    youtubeId: string
    genre?: string | null
    publishedAt: Date
    duration?: string | null
    viewCount: number
  }
}

export default function VideoCard({ video }: VideoCardProps) {
  // Usar a mesma URL de thumbnail que é gerada no formulário
  const thumbnailUrl = video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`
  const [formattedDate, setFormattedDate] = useState<string>('')
  const [formattedViews, setFormattedViews] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    // Marcar como montado apenas no cliente para evitar hydration mismatch
    setMounted(true)
  }, [])

  useEffect(() => {
    // Formatar data e visualizações apenas no cliente após montagem para evitar problemas de hidratação
    if (!mounted) return
    
    setFormattedDate(formatDateShort(video.publishedAt))
    if (video.viewCount > 0) {
      setFormattedViews(formatIntegerPtBR(video.viewCount))
    }
  }, [video.publishedAt, video.viewCount, mounted])

  return (
    <Link href={`/videos/${video.slug}`}>
      <div className="group relative overflow-hidden rounded-lg bg-gray-900 border border-gray-800 hover:border-primary-500 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20">
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          <Image
            src={thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity neon-glow">
              <FiPlay className="w-6 h-6 text-white ml-1" />
            </div>
          </div>
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded flex items-center space-x-1 text-xs">
              <FiClock className="w-3 h-3" />
              <span>{video.duration}</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="mb-2">
            {video.genre && (
              <span className="text-xs px-2 py-1 rounded bg-primary-900/50 text-primary-300 border border-primary-800">
                {video.genre}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-primary-400 transition-colors">
            {video.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{mounted ? formattedDate : formatDateShort(video.publishedAt)}</span>
            {video.viewCount > 0 && (
              <span>
                {mounted ? formattedViews : formatIntegerPtBR(video.viewCount)} visualizações
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
