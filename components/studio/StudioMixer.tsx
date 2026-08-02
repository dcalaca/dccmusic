'use client'

import { useMemo } from 'react'
import { useStudioProject } from './ProjectProvider'
import { usePlayback } from './PlaybackContext'

const TRACK_COLORS = [
  '#84cc16', // lime
  '#14b8a6', // teal
  '#22d3ee', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#eab308', // yellow
  '#10b981', // emerald
  '#06b6d4', // sky
  '#f43f5e', // rose
]

function colorForStem(type: string, index: number) {
  const key = type.toLowerCase()
  if (key.includes('vocal') && key.includes('back')) return TRACK_COLORS[5]
  if (key.includes('vocal')) return TRACK_COLORS[0]
  if (key.includes('drum')) return TRACK_COLORS[1]
  if (key.includes('bass')) return TRACK_COLORS[2]
  if (key.includes('guitar')) return TRACK_COLORS[3]
  if (key.includes('key') || key.includes('piano')) return TRACK_COLORS[4]
  if (key.includes('string')) return TRACK_COLORS[6]
  if (key.includes('brass')) return TRACK_COLORS[7]
  if (key.includes('synth')) return TRACK_COLORS[8]
  return TRACK_COLORS[index % TRACK_COLORS.length]
}

function WaveformBars({
  peaks,
  color,
  muted,
}: {
  peaks: number[]
  color: string
  muted?: boolean
}) {
  return (
    <div className={`flex h-full items-center gap-[1px] px-2 ${muted ? 'opacity-35' : ''}`}>
      {peaks.map((peak, index) => (
        <div
          key={index}
          className="w-[2px] rounded-sm"
          style={{
            height: `${Math.max(8, peak * 100)}%`,
            backgroundColor: color,
            opacity: 0.55 + peak * 0.45,
          }}
        />
      ))}
    </div>
  )
}

export default function StudioMixer() {
  const { project, stems, trim, toggleMute, toggleSolo, setStemVolume } = useStudioProject()
  const playback = usePlayback()

  const duration = Math.max(playback.duration, 1)
  const trimEnd = trim.endSec == null ? duration : Math.min(trim.endSec, duration)
  const playheadPct = Math.min(100, Math.max(0, (playback.currentTime / duration) * 100))
  const trimStartPct = Math.min(100, Math.max(0, (trim.startSec / duration) * 100))
  const trimEndPct = Math.min(100, Math.max(0, (trimEnd / duration) * 100))

  const markers = useMemo(() => {
    const count = 9
    return Array.from({ length: count }, (_, i) => Math.round((i / (count - 1)) * duration))
  }, [duration])

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-[#0b0d10]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{project.title || 'Untitled Project'}</p>
          <p className="text-[11px] text-zinc-500">
            {playback.loading
              ? 'Carregando stems...'
              : playback.ready
                ? `${stems.filter((s) => s.url).length} faixas prontas`
                : `${stems.length} faixas — separe o áudio para tocar de verdade`}
          </p>
        </div>
        {playback.error && (
          <p className="text-[11px] text-red-300">{playback.error}</p>
        )}
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-20 flex border-b border-white/10 bg-[#0b0d10]/95 backdrop-blur">
          <div className="w-[168px] shrink-0 border-r border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 sm:w-[200px]">
            Faixas
          </div>
          <div className="relative min-w-[720px] flex-1 px-2 py-2">
            <div className="relative h-5">
              {markers.map((mark, index) => (
                <span
                  key={mark}
                  className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-zinc-500"
                  style={{ left: `${(index / (markers.length - 1)) * 100}%` }}
                >
                  {mark}s
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `calc(0px + ${playheadPct}%)` }}>
              <div className="h-full w-px bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            </div>
          </div>
        </div>

        <div className="min-w-[900px]">
          {stems.map((stem, index) => {
            const color = colorForStem(stem.type, index)
            const peaks = playback.getPeaks(stem.id, 96)
            const offsetSec = Number(stem.offsetSec || 0)
            const leftPct = Math.min(90, (offsetSec / duration) * 100)
            const widthPct = Math.max(18, 100 - leftPct - (100 - trimEndPct) * 0.15)

            return (
              <div key={stem.id} className="flex border-b border-white/5">
                <div className="flex w-[168px] shrink-0 flex-col justify-center gap-2 border-r border-white/10 bg-[#101216] px-3 py-3 sm:w-[200px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-zinc-100" title={stem.name}>
                      {stem.name}
                    </p>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleMute(stem.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        stem.muted
                          ? 'bg-zinc-200 text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Mute"
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSolo(stem.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        stem.solo
                          ? 'bg-white text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Solo"
                    >
                      S
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={stem.volume}
                      onChange={(e) => setStemVolume(stem.id, Number(e.target.value))}
                      className="ml-1 h-1 w-full cursor-pointer accent-white"
                      aria-label={`Volume ${stem.name}`}
                    />
                  </div>
                  {!stem.url && (
                    <p className="text-[10px] text-zinc-600">Sem áudio nesta faixa</p>
                  )}
                </div>

                <div className="relative min-h-[72px] flex-1 bg-[#0b0d10] py-2 pr-3">
                  {/* região fora do corte */}
                  <div
                    className="pointer-events-none absolute inset-y-2 left-0 bg-black/45"
                    style={{ width: `${trimStartPct}%` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-2 right-0 bg-black/45"
                    style={{ width: `${Math.max(0, 100 - trimEndPct)}%` }}
                  />

                  <div
                    className={`absolute inset-y-2 overflow-hidden rounded-lg border border-black/20 shadow-lg ${
                      stem.muted ? 'opacity-40' : ''
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: `linear-gradient(180deg, ${color}cc, ${color}99)`,
                    }}
                  >
                    <div className="absolute left-2 top-1 z-10 truncate text-[10px] font-semibold text-black/80">
                      {stem.name}
                    </div>
                    <div className="absolute inset-0 pt-4">
                      <WaveformBars peaks={peaks} color="rgba(0,0,0,0.55)" muted={stem.muted} />
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
