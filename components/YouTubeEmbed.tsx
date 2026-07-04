'use client'

import { useEffect, useState } from 'react'

interface YouTubeEmbedProps {
  videoId: string
  autoplay?: boolean
}

export default function YouTubeEmbed({ videoId, autoplay = false }: YouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  if (!isLoaded) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Carregando vídeo...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900">
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}${autoplay ? '?autoplay=1' : ''}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
