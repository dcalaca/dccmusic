'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useStudioProject } from './ProjectProvider'
import { useStemEngine } from './useStemEngine'

type PlaybackContextValue = ReturnType<typeof useStemEngine>

const PlaybackContext = createContext<PlaybackContextValue | null>(null)

export function PlaybackProvider({
  children,
  authToken,
}: {
  children: ReactNode
  authToken?: string | null
}) {
  const { stems, masterVolume, trim, setAudioDuration } = useStudioProject()
  const engine = useStemEngine({
    stems,
    masterVolume,
    trim,
    authToken,
    onDuration: setAudioDuration,
  })

  return (
    <PlaybackContext.Provider value={engine}>
      {children}
    </PlaybackContext.Provider>
  )
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback deve ser usado dentro de PlaybackProvider')
  return ctx
}
