'use client'

import { FiMusic } from 'react-icons/fi'
import { useStudioProject } from './ProjectProvider'
import TrackItem from './TrackItem'

export default function StudioSidebar() {
  const { project, stems } = useStudioProject()

  return (
    <aside className="flex h-full w-full flex-col border-zinc-800 bg-zinc-950 lg:w-[300px] lg:shrink-0 lg:border-r">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
            {project.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <FiMusic className="h-7 w-7 text-zinc-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Projeto
            </p>
            <h2 className="truncate text-sm font-semibold text-white" title={project.title}>
              {project.title}
            </h2>
            <p className="truncate text-xs text-zinc-400">{project.artist}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">
              {project.id}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Stems
        </p>
        <div className="flex flex-col gap-2">
          {stems.map((stem) => (
            <TrackItem key={stem.id} stem={stem} />
          ))}
        </div>
      </div>
    </aside>
  )
}
