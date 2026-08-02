'use client'

import { FiPause, FiPlay, FiScissors, FiVolume2 } from 'react-icons/fi'
import { useStudioProject } from './ProjectProvider'
import { usePlayback } from './PlaybackContext'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function StudioPlayer() {
  const {
    project,
    stems,
    masterVolume,
    setMasterVolume,
    trim,
    audioDuration,
    setTrimStart,
    setTrimEnd,
    resetTrim,
  } = useStudioProject()
  const playback = usePlayback()

  const duration = playback.duration || audioDuration || 0
  const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration || trim.endSec)
  const hasPlayable = stems.some((stem) => stem.url) && playback.ready
  const hasTrim =
    duration > 0 &&
    (trim.startSec > 0.05 || (trim.endSec != null && trim.endSec < duration - 0.05))

  const togglePlay = async () => {
    if (playback.playing) {
      playback.pause()
      return
    }
    await playback.play()
  }

  return (
    <div className="border-t border-zinc-800 bg-[#0b0d10] px-3 py-3 sm:px-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasPlayable}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            aria-label={playback.playing ? 'Pausar' : 'Reproduzir'}
          >
            {playback.playing ? (
              <FiPause className="h-5 w-5" />
            ) : (
              <FiPlay className="ml-0.5 h-5 w-5" />
            )}
          </button>
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-xs font-medium text-zinc-200">{project.title}</p>
            <p className="truncate text-[11px] text-zinc-500">
              {playback.loading ? 'Carregando...' : `${stems.filter((s) => s.url).length} stems`}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
            {formatTime(playback.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={playback.currentTime}
            disabled={!duration}
            onChange={(e) => playback.seek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white disabled:cursor-not-allowed"
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
            className="h-1.5 w-full cursor-pointer accent-white"
            aria-label="Volume master"
          />
        </div>
      </div>

      {duration > 0 && (
        <div className="mx-auto mt-3 max-w-6xl rounded-xl border border-white/10 bg-zinc-900/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
              <FiScissors className="h-3.5 w-3.5 text-emerald-400" />
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
                className="mt-1 h-1.5 w-full cursor-pointer accent-emerald-400"
              />
            </label>
            <label className="text-[11px] text-zinc-400">
              Fim
              <input
                type="range"
                min={Math.min(duration, trim.startSec + 0.1)}
                max={duration || 0}
                step={0.1}
                value={trimEnd || duration}
                onChange={(e) => setTrimEnd(Number(e.target.value))}
                className="mt-1 h-1.5 w-full cursor-pointer accent-emerald-400"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTrimStart(playback.currentTime)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
            >
              Início = posição atual
            </button>
            <button
              type="button"
              onClick={() => setTrimEnd(playback.currentTime)}
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

      {!hasPlayable && (
        <p className="mx-auto mt-2 max-w-6xl text-center text-[11px] text-zinc-600">
          Depois da separação, o play toca todas as faixas juntas. Mute/Solo/volume funcionam de verdade.
        </p>
      )}
    </div>
  )
}
