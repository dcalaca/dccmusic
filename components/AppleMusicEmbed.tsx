'use client'

import { useEffect, useState } from 'react'

interface AppleMusicEmbedProps {
  embedCode: string
}

export default function AppleMusicEmbed({ embedCode }: AppleMusicEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)

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
      dangerouslySetInnerHTML={{ __html: embedCode }}
    />
  )
}
