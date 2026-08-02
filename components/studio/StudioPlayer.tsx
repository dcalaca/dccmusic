'use client'

import { useEffect, useRef, useState } from 'react'
import { FiPause, FiPlay, FiScissors, FiVolume2 } from 'react-icons/fi'
import { useStudioProject } from './ProjectProvider'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function StudioPlayer() {
  const {
    project,
    masterVolume,
    setMasterVolume,
    trim,
    audioDuration,
    setAudioDuration,
    setTrimStart,
    setTrimEnd,
    resetTrim,
  } = useStudioProject()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const hasAudio = Boolean(project.audioUrl)
  const duration = audioDuration || 0
  const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration || trim.endSec)
  const hasTrim =
    duration > 0 &&
    (trim.startSec > 0.05 || (trim.endSec != null && trim.endSec < duration - 0.05))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, masterVolume / 100))
  }, [masterVolume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setPlaying(false)
    setCurrentTime(0)
    audio.pause()
    audio.currentTime = 0
  }, [project.audioUrl])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || !hasAudio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      if (audio.currentTime < trim.startSec || (trimEnd > 0 && audio.currentTime >= trimEnd)) {
        audio.currentTime = trim.startSec
      }
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const onSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    const clamped =
      trimEnd > trim.startSec
        ? Math.max(trim.startSec, Math.min(value, trimEnd))
        : Math.max(0, value)
    audio.currentTime = clamped
    setCurrentTime(clamped)
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    const t = audio.currentTime || 0
    setCurrentTime(t)
    if (trimEnd > trim.startSec && t >= trimEnd - 0.03) {
      audio.pause()
      audio.currentTime = trim.startSec
      setPlaying(false)
      setCurrentTime(trim.startSec)
    }
  }

  const startPct = duration > 0 ? (trim.startSec / duration) * 100 : 0
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur sm:px-4">
      {hasAudio && (
        <audio
          ref={audioRef}
          src={project.audioUrl || undefined}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            const next = audioRef.current?.duration || 0
            setAudioDuration(next)
            setCurrentTime(audioRef.current?.currentTime || 0)
          }}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasAudio}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
          >
            {playing ? <FiPause className="h-5 w-5" /> : <FiPlay className="ml-0.5 h-5 w-5" />}
          </button>
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-xs font-medium text-zinc-200">{project.title}</p>
            <p className="truncate text-[11px] text-zinc-500">{project.artist}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            disabled={!hasAudio || !duration}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary-500 disabled:cursor-not-allowed"
            aria-label="Progresso"
          />
          <span className="w-10 shrink-0 text-[11px] tabular-nums text-zinc-500">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:w-36">
          <FiVolume2 className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            type="range"
            min={0}
            max={100}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary-500"
            aria-label="Volume master"
          />
        </div>
      </div>

      {hasAudio && duration > 0 && (
        <div className="mx-auto mt-3 max-w-5xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
              <FiScissors className="h-3.5 w-3.5 text-primary-400" />
              Cortar trecho
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Grátis
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Trecho: {formatTime(trim.startSec)} → {formatTime(trimEnd || duration)}
              {hasTrim ? '' : ' (música inteira)'}
            </p>
          </div>

          <div className="relative mb-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="absolute inset-y-0 bg-primary-500/70"
              style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] text-zinc-400">
              Início
              <input
                type="range"
                min={0}
                max={Math.max(0, (trimEnd || duration) - 0.1)}
                step={0.1}
                value={trim.startSec}
                onChange={(e) => setTrimStart(Number(e.target.value))}
                className="mt-1 h-1.5 w-full cursor-pointer accent-primary-500"
              />
            </label>
            <label className="text-[11px] text-zinc-400">
              Fim
              <input
                type="range"
                min={Math.min(duration, trim.startSec + 0.1)}
                max={duration}
                step={0.1}
                value={trimEnd || duration}
                onChange={(e) => setTrimEnd(Number(e.target.value))}
                className="mt-1 h-1.5 w-full cursor-pointer accent-primary-500"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTrimStart(currentTime)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
            >
              Início = posição atual
            </button>
            <button
              type="button"
              onClick={() => setTrimEnd(currentTime)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
            >
              Fim = posição atual
            </button>
            <button
              type="button"
              onClick={resetTrim}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
            >
              Música inteira
            </button>
          </div>
        </div>
      )}

      {!hasAudio && (
        <p className="mx-auto mt-2 max-w-5xl text-center text-[11px] text-zinc-600">
          Sem áudio de preview. Depois da separação você pode cortar o trecho aqui (grátis).
        </p>
      )}
    </div>
  )
}
