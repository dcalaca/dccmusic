'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

export default function StudioPreviewPlayer({ audioUrl, premium = false }: { audioUrl: string; premium?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [locked, setLocked] = useState(false)

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio || premium) return

    if (audio.currentTime >= 20) {
      audio.pause()
      audio.currentTime = 20
      setLocked(true)
    }
  }

  return (
    <div>
      <audio
        ref={audioRef}
        controls
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        className="w-full"
      />
      {!premium && locked && (
        <div className="mt-4 rounded-xl border border-primary-800 bg-primary-950/50 p-4 text-sm text-primary-100">
          Preview gratuito encerrado em 20 segundos. Assine o DCC Studio IA para ouvir completo e baixar MP3.
          <Link href="/studio-ia#planos" className="ml-2 font-semibold text-white underline">
            Ver plano
          </Link>
        </div>
      )}
    </div>
  )
}
