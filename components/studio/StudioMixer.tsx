'use client'

import { FiSliders } from 'react-icons/fi'
import { useStudioProject } from './ProjectProvider'

const stemAccent: Record<string, string> = {
  vocal: 'from-rose-500/20 to-transparent border-rose-500/30',
  drums: 'from-amber-500/20 to-transparent border-amber-500/30',
  bass: 'from-sky-500/20 to-transparent border-sky-500/30',
  others: 'from-emerald-500/20 to-transparent border-emerald-500/30',
}

export default function StudioMixer() {
  const { stems } = useStudioProject()

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-zinc-950/80">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <FiSliders className="h-4 w-4 text-primary-400" />
          <h3 className="text-sm font-semibold">Mixer</h3>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Em breve
        </span>
      </div>

      <div className="relative flex flex-1 flex-col p-4">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-6 py-5 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-zinc-300">Mixer — em breve</p>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">
              Timeline, waveform e edição por região serão adicionados aqui sem mudar esta estrutura.
            </p>
          </div>
        </div>

        <div className="grid h-full min-h-[220px] flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          {stems.map((stem) => (
            <div
              key={stem.id}
              className={`flex flex-col rounded-xl border bg-gradient-to-b p-3 ${
                stemAccent[stem.type] || 'from-zinc-800/40 to-transparent border-zinc-800'
              } ${stem.muted ? 'opacity-40' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">{stem.name}</span>
                {stem.solo && (
                  <span className="rounded bg-amber-500 px-1 text-[9px] font-bold text-black">
                    SOLO
                  </span>
                )}
              </div>
              <div className="flex flex-1 items-end justify-center gap-1 pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-sm bg-zinc-700/80"
                    style={{ height: `${18 + ((i * 13 + stem.volume) % 50)}%` }}
                  />
                ))}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-primary-500/70"
                  style={{ width: `${stem.volume}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
