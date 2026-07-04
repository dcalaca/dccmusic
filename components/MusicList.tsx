'use client'

import MusicCard from './MusicCard'

interface MusicListProps {
  musics: Array<{
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
  }>
  view?: 'lista' | 'grid'
}

export default function MusicList({ musics, view = 'lista' }: MusicListProps) {

  if (view === 'lista') {
    return (
      <div className="space-y-3">
        {musics.map((music) => (
          <MusicCard key={music.id} music={music} view="lista" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {musics.map((music) => (
        <MusicCard key={music.id} music={music} view="grid" />
      ))}
    </div>
  )
}
