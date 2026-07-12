import { FiMessageCircle, FiMusic, FiPlayCircle, FiUsers, FiZap } from 'react-icons/fi'
import { formatIntegerPtBR } from '@/lib/utils'

type AiMusicDay = {
  date: string
  label: string
  deliveredMusics: number
}

export type SiteStatsCompactProps = {
  totalVideos: number
  videoViews: number
  totalMusics: number
  musicViews: number
  totalComposers?: number
  totalSiteUsers?: number
  totalComments?: number
  totalRatings?: number
  deliveredAiMusics?: number
  aiMusicDays?: AiMusicDay[]
}

export default function SiteStatsCompact({
  totalVideos,
  videoViews,
  totalMusics,
  musicViews,
  totalComposers = 0,
  totalSiteUsers = 0,
  totalComments = 0,
  totalRatings = 0,
  deliveredAiMusics = 0,
  aiMusicDays = [],
}: SiteStatsCompactProps) {
  const totalUsers = totalComposers + totalSiteUsers
  const totalInteractions = totalComments + totalRatings
  const maxAiDay = Math.max(1, ...aiMusicDays.map(day => day.deliveredMusics))

  return (
    <section className="overflow-hidden bg-black py-8 sm:py-12">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl min-w-0">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-300">Em atividade no site</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              A força do DCC Music em números
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-400">
              Catálogo, audiência, comunidade e Studio IA crescendo todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-cyan-900/70 bg-gray-950 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">Total de vídeos</p>
              <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                {formatIntegerPtBR(totalVideos)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                Visualizações: {formatIntegerPtBR(videoViews)}
              </p>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-300 sm:h-10 sm:w-10"
              aria-hidden
            >
              <FiPlayCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
            </div>
          </div>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-primary-900/70 bg-gray-950 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">Total de músicas</p>
              <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                {formatIntegerPtBR(totalMusics)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                Visualizações: {formatIntegerPtBR(musicViews)}
              </p>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-950 text-primary-300 sm:h-10 sm:w-10"
              aria-hidden
            >
              <FiMusic className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
            </div>
          </div>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-green-900/70 bg-gray-950 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">Comunidade</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                  {formatIntegerPtBR(totalUsers)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {formatIntegerPtBR(totalComposers)} compositores + {formatIntegerPtBR(totalSiteUsers)} ouvintes
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-950 text-green-300 sm:h-10 sm:w-10" aria-hidden>
                <FiUsers className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-yellow-900/70 bg-gray-950 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">Interações</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                  {formatIntegerPtBR(totalInteractions)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {formatIntegerPtBR(totalComments)} comentários + {formatIntegerPtBR(totalRatings)} avaliações
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-950 text-yellow-300 sm:h-10 sm:w-10" aria-hidden>
                <FiMessageCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>
          </div>

          {aiMusicDays.length > 0 && (
            <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-purple-900/70 bg-gradient-to-br from-purple-950/45 via-gray-950 to-black p-3 sm:p-5">
                <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white">Músicas IA entregues</h3>
                    <p className="mt-1 text-xs text-gray-400 sm:text-sm">
                      Últimos 14 dias
                    </p>
                  </div>
                  <div className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-purple-700 bg-purple-950/60 px-3 py-2 sm:w-auto sm:justify-start sm:gap-3 sm:px-4">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-purple-300/70 sm:text-[11px]">Músicas criadas</p>
                    <p className="whitespace-nowrap text-lg font-black leading-none text-purple-100 sm:text-2xl">+ de 1.000</p>
                  </div>
                </div>

                <div className="flex h-36 min-w-0 items-end gap-1 border-b border-gray-800 px-0.5 pb-2 sm:h-44 sm:gap-2 sm:px-1">
                  {aiMusicDays.map(day => {
                    const height = day.deliveredMusics > 0 ? Math.max(8, (day.deliveredMusics / maxAiDay) * 100) : 0
                    return (
                      <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 sm:gap-2">
                        <div className="flex h-24 w-full max-w-7 items-end rounded-t-md bg-gray-900 sm:h-32 sm:max-w-9 sm:rounded-t-lg">
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-purple-600 to-primary-400 sm:rounded-t-lg"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-gray-600 sm:text-[10px]">{day.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-purple-900/70 bg-gradient-to-br from-gray-950 via-purple-950/35 to-gray-950 px-5 py-5 lg:flex-col lg:items-start lg:justify-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-purple-300">
                    Studio IA
                  </p>
                  <p className="mt-1 text-3xl font-black leading-none text-white tabular-nums sm:text-4xl">
                    {formatIntegerPtBR(deliveredAiMusics)}
                  </p>
                  <p className="mt-2 text-sm font-bold leading-snug text-purple-100">
                    músicas criadas
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">Atualização em tempo real</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-950 text-purple-300 ring-1 ring-purple-500/30" aria-hidden>
                  <FiZap className="h-5 w-5" strokeWidth={2} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
