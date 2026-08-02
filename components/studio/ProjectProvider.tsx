'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createMockProject, createMockStems } from './mock-data'
import type { AudioTrim, Stem, StudioProject } from './types'

type ProjectContextValue = {
  project: StudioProject
  stems: Stem[]
  jobId: string | null
  masterVolume: number
  audioDuration: number
  trim: AudioTrim
  setMasterVolume: (volume: number) => void
  setStemVolume: (stemId: string, volume: number) => void
  toggleMute: (stemId: string) => void
  toggleSolo: (stemId: string) => void
  setAudioDuration: (duration: number) => void
  setTrimStart: (startSec: number) => void
  setTrimEnd: (endSec: number | null) => void
  resetTrim: () => void
  loadJob: (input: {
    jobId: string
    project: StudioProject
    stems: Stem[]
  }) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

type ProjectProviderProps = {
  children: ReactNode
  projectId?: string
  initialProject?: StudioProject
  initialStems?: Stem[]
  initialJobId?: string | null
}

export function ProjectProvider({
  children,
  projectId,
  initialProject,
  initialStems,
  initialJobId = null,
}: ProjectProviderProps) {
  const [project, setProject] = useState<StudioProject>(
    () => initialProject || createMockProject(projectId)
  )
  const [stems, setStems] = useState<Stem[]>(() => initialStems || createMockStems())
  const [jobId, setJobId] = useState<string | null>(initialJobId)
  const [masterVolume, setMasterVolume] = useState(80)
  const [audioDuration, setAudioDurationState] = useState(0)
  const [trim, setTrim] = useState<AudioTrim>({ startSec: 0, endSec: null })

  const setStemVolume = useCallback((stemId: string, volume: number) => {
    const next = Math.max(0, Math.min(100, volume))
    setStems((prev) =>
      prev.map((stem) => (stem.id === stemId ? { ...stem, volume: next } : stem))
    )
  }, [])

  const toggleMute = useCallback((stemId: string) => {
    setStems((prev) =>
      prev.map((stem) =>
        stem.id === stemId ? { ...stem, muted: !stem.muted } : stem
      )
    )
  }, [])

  const toggleSolo = useCallback((stemId: string) => {
    setStems((prev) =>
      prev.map((stem) =>
        stem.id === stemId ? { ...stem, solo: !stem.solo } : stem
      )
    )
  }, [])

  const setAudioDuration = useCallback((duration: number) => {
    const safe = Number.isFinite(duration) && duration > 0 ? duration : 0
    setAudioDurationState(safe)
    setTrim((prev) => {
      if (safe <= 0) return prev
      const start = Math.max(0, Math.min(prev.startSec, Math.max(0, safe - 0.1)))
      const end =
        prev.endSec == null
          ? safe
          : Math.max(start + 0.1, Math.min(prev.endSec, safe))
      return { startSec: start, endSec: end }
    })
  }, [])

  const setTrimStart = useCallback((startSec: number) => {
    setTrim((prev) => {
      const end = prev.endSec
      const maxStart = end == null ? Number.POSITIVE_INFINITY : Math.max(0, end - 0.1)
      const nextStart = Math.max(0, Math.min(startSec, maxStart))
      return { ...prev, startSec: nextStart }
    })
  }, [])

  const setTrimEnd = useCallback((endSec: number | null) => {
    setTrim((prev) => {
      if (endSec == null) return { ...prev, endSec: null }
      const nextEnd = Math.max(prev.startSec + 0.1, endSec)
      return { ...prev, endSec: nextEnd }
    })
  }, [])

  const resetTrim = useCallback(() => {
    setTrim({
      startSec: 0,
      endSec: audioDuration > 0 ? audioDuration : null,
    })
  }, [audioDuration])

  const loadJob = useCallback((input: {
    jobId: string
    project: StudioProject
    stems: Stem[]
  }) => {
    setJobId(input.jobId)
    setProject(input.project)
    setStems(input.stems)
    setAudioDurationState(0)
    setTrim({ startSec: 0, endSec: null })
  }, [])

  const value = useMemo(
    () => ({
      project,
      stems,
      jobId,
      masterVolume,
      audioDuration,
      trim,
      setMasterVolume,
      setStemVolume,
      toggleMute,
      toggleSolo,
      setAudioDuration,
      setTrimStart,
      setTrimEnd,
      resetTrim,
      loadJob,
    }),
    [
      project,
      stems,
      jobId,
      masterVolume,
      audioDuration,
      trim,
      setStemVolume,
      toggleMute,
      toggleSolo,
      setAudioDuration,
      setTrimStart,
      setTrimEnd,
      resetTrim,
      loadJob,
    ]
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useStudioProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useStudioProject deve ser usado dentro de ProjectProvider')
  }
  return ctx
}
