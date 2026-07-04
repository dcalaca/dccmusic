'use client'

import Link from 'next/link'
import { FiMusic, FiPlayCircle } from 'react-icons/fi'

interface GenreCardProps {
  genre: {
    id: string
    name: string
    slug: string
    color?: string | null
  }
  count?: number
  videosCount?: number
  musicsCount?: number
}

export default function GenreCard({ genre, count, videosCount, musicsCount }: GenreCardProps) {
  const bgColor = genre.color || 'bg-gradient-to-br from-primary-600 to-purple-600'
  const totalVideos = videosCount || 0
  const totalMusics = musicsCount || 0
  const totalCount = count || (totalVideos + totalMusics)

  return (
    <div className="group relative overflow-hidden rounded-lg bg-gray-900 border border-gray-800 hover:border-primary-500 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20 flex flex-col h-full">
      <div className={`${bgColor} p-4 flex flex-col items-center justify-center flex-1 min-h-[140px] transition-transform duration-300 group-hover:scale-105`}>
        <FiMusic className="w-8 h-8 text-white mb-2" />
        <h3 className="font-bold text-white text-lg mb-2">{genre.name}</h3>
        {totalCount > 0 && (
          <span className="text-white/90 text-sm font-semibold mb-2">{totalCount} itens</span>
        )}
        <div className="text-white/80 text-xs text-center space-y-1 w-full min-h-[32px] flex flex-col justify-center">
          {totalMusics > 0 && (
            <div className="flex items-center justify-center gap-1">
              <span>{totalMusics} música{totalMusics !== 1 ? 's' : ''}</span>
            </div>
          )}
          {totalVideos > 0 && (
            <div className="flex items-center justify-center gap-1">
              <span>{totalVideos} vídeo{totalVideos !== 1 ? 's' : ''}</span>
            </div>
          )}
          {totalMusics === 0 && totalVideos === 0 && (
            <div className="h-4"></div>
          )}
        </div>
      </div>
      {/* Links de ação */}
      <div className="bg-gray-900 p-2 flex gap-2 mt-auto">
        {totalMusics > 0 && (
          <Link
            href={`/musicas?genero=${encodeURIComponent(genre.name)}`}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-800 hover:bg-primary-600 rounded transition-colors text-xs text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <FiMusic className="w-3 h-3" />
            <span>Músicas</span>
          </Link>
        )}
        {totalVideos > 0 && (
          <Link
            href={`/videos?genero=${encodeURIComponent(genre.name)}`}
            className={`${totalMusics > 0 ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-800 hover:bg-primary-600 rounded transition-colors text-xs text-white`}
            onClick={(e) => e.stopPropagation()}
          >
            <FiPlayCircle className="w-3 h-3" />
            <span>Vídeos</span>
          </Link>
        )}
      </div>
    </div>
  )
}
