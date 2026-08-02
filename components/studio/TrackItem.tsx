'use client'

import { FiMic, FiMusic, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { useStudioProject } from './ProjectProvider'
import type { Stem, StemType } from './types'

const stemIcon: Record<StemType, typeof FiMic> = {
  vocal: FiMic,
  drums: FiMusic,
  bass: FiMusic,
  others: FiMusic,
}

const stemAccent: Record<StemType, string> = {
  vocal: 'bg-rose-500',
  drums: 'bg-amber-500',
  bass: 'bg-sky-500',
  others: 'bg-emerald-500',
}

type TrackItemProps = {
  stem: Stem
}

export default function TrackItem({ stem }: TrackItemProps) {
  const { setStemVolume, toggleMute, toggleSolo } = useStudioProject()
  const Icon = stemIcon[stem.type]

  return (
    <div
      className={`rounded-xl border px-3 py-3 transition ${
        stem.muted
          ? 'border-zinc-800 bg-zinc-900/40 opacity-60'
          : stem.solo
            ? 'border-primary-500/50 bg-primary-950/30'
            : 'border-zinc-800 bg-zinc-900/70'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${stemAccent[stem.type]}`} />
        <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
          {stem.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleSolo(stem.id)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
              stem.solo
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            aria-pressed={stem.solo}
            title="Solo"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => toggleMute(stem.id)}
            className={`rounded p-1 ${
              stem.muted
                ? 'bg-zinc-700 text-zinc-200'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            aria-pressed={stem.muted}
            title={stem.muted ? 'Desmutar' : 'Mutar'}
          >
            {stem.muted ? (
              <FiVolumeX className="h-3.5 w-3.5" />
            ) : (
              <FiVolume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={stem.volume}
          onChange={(e) => setStemVolume(stem.id, Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer accent-primary-500"
          aria-label={`Volume ${stem.name}`}
        />
        <span className="w-8 text-right text-[11px] tabular-nums text-zinc-500">
          {stem.volume}
        </span>
      </div>

      {!stem.url && (
        <p className="mt-2 text-[10px] text-zinc-600">Stem mock — sem áudio</p>
      )}
    </div>
  )
}
