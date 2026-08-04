import type { ReactNode } from 'react'
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

function StatMiniCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  tone: 'green' | 'yellow' | 'cyan' | 'purple'
}) {
  const tones = {
    green: {
      border: 'border-green-900/70',
      iconWrap: 'bg-green-950 text-green-300',
      label: 'text-green-300/80',
    },
    yellow: {
      border: 'border-yellow-900/70',
      iconWrap: 'bg-yellow-950 text-yellow-300',
      label: 'text-yellow-300/80',
    },
    cyan: {
      border: 'border-cyan-900/70',
      iconWrap: 'bg-cyan-950 text-cyan-300',
      label: 'text-cyan-300/80',
    },
    purple: {
      border: 'border-purple-900/70',
      iconWrap: 'bg-purple-950 text-purple-300',
      label: 'text-purple-300/80',
    },
  }[tone]

  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border ${tones.border} bg-gray-950/90 px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-bold uppercase tracking-wide ${tones.label}`}>{label}</p>
        <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums sm:text-3xl">{value}</p>
        <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">{hint}</p>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tones.iconWrap}`} aria-hidden>
        {icon}
      </div>
    </div>
  )
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
  const maxAiDay = Math.max(1, ...aiMusicDays.map((day) => day.deliveredMusics))

  // Derivados só do array já carregado (sem consulta extra).
  const chartTotal = aiMusicDays.reduce((sum, day) => sum + day.deliveredMusics, 0)
  const chartAvg = aiMusicDays.length > 0 ? Math.round(chartTotal / aiMusicDays.length) : 0
  const chartPeak = aiMusicDays.reduce((max, day) => Math.max(max, day.deliveredMusics), 0)
  const chartLastDay = aiMusicDays.length > 0 ? aiMusicDays[aiMusicDays.length - 1] : null

  return (
    <section className="overflow-hidden bg-black py-8 sm:py-12">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl min-w-0">
          <div className="mb-6 text-center">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-300">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400" aria-hidden />
              Em atividade no site
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              A força do DCC Music em números
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-400">
              Studio IA, comunidade e engajamento crescendo todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-[1.6rem] border border-purple-500/30 bg-gradient-to-br from-purple-950/70 via-[#12061f] to-black p-5 shadow-[0_0_40px_rgba(147,51,234,0.18)] sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-300">
                    Músicas criadas na DCC
                  </p>
                  <p className="mt-3 text-4xl font-black leading-none text-white tabular-nums sm:text-5xl">
                    {formatIntegerPtBR(deliveredAiMusics)}
                  </p>
                  <p className="mt-3 text-base font-semibold text-purple-100/90">
                    músicas criadas com IA
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[11px] font-bold lowercase tracking-wide text-purple-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                    atualização em tempo real
                  </span>
                </div>
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-200 ring-1 ring-purple-400/35"
                  aria-hidden
                >
                  <FiZap className="h-6 w-6" strokeWidth={2} />
                </div>
              </div>

              {totalComposers > 0 && (
                <p className="relative mt-6 border-t border-white/10 pt-4 text-sm text-gray-300">
                  Mais de {formatIntegerPtBR(totalComposers)} compositores já utilizam o DCC Music Studio.
                </p>
              )}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <StatMiniCard
                label="Comunidade"
                value={formatIntegerPtBR(totalUsers)}
                hint={`${formatIntegerPtBR(totalComposers)} compositores + ${formatIntegerPtBR(totalSiteUsers)} ouvintes`}
                tone="green"
                icon={<FiUsers className="h-[18px] w-[18px]" strokeWidth={2} />}
              />
              <StatMiniCard
                label="Interações"
                value={formatIntegerPtBR(totalInteractions)}
                hint={`${formatIntegerPtBR(totalComments)} comentários + ${formatIntegerPtBR(totalRatings)} avaliações`}
                tone="yellow"
                icon={<FiMessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />}
              />
            </div>
          </div>

          {aiMusicDays.length > 0 && (
            <div className="mt-4 min-w-0 overflow-hidden rounded-[1.6rem] border border-purple-900/70 bg-gradient-to-br from-purple-950/45 via-gray-950 to-black p-3 sm:p-5">
              <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white">Músicas IA entregues</h3>
                  <p className="mt-1 text-xs text-gray-400 sm:text-sm">Últimos 14 dias</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300">
                    Média/dia: <strong className="text-white">{formatIntegerPtBR(chartAvg)}</strong>
                  </span>
                  {chartLastDay && (
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300">
                      {chartLastDay.label}: <strong className="text-white">{formatIntegerPtBR(chartLastDay.deliveredMusics)}</strong>
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-gray-300">
                    Pico: <strong className="text-white">{formatIntegerPtBR(chartPeak)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex h-36 min-w-0 items-end gap-1 border-b border-gray-800 px-0.5 pb-2 sm:h-44 sm:gap-2 sm:px-1">
                {aiMusicDays.map((day) => {
                  const height = day.deliveredMusics > 0 ? Math.max(8, (day.deliveredMusics / maxAiDay) * 100) : 0
                  return (
                    <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 sm:gap-2">
                      <div className="flex h-24 w-full max-w-7 items-end rounded-t-md bg-gray-900/80 sm:h-32 sm:max-w-9 sm:rounded-t-lg">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-purple-600 to-primary-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] sm:rounded-t-lg"
                          style={{ height: `${height}%` }}
                          title={`${day.label}: ${formatIntegerPtBR(day.deliveredMusics)}`}
                        />
                      </div>
                      <span className="text-[8px] text-gray-600 sm:text-[10px]">{day.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatMiniCard
              label="Total de vídeos"
              value={formatIntegerPtBR(totalVideos)}
              hint={`Visualizações: ${formatIntegerPtBR(videoViews)}`}
              tone="cyan"
              icon={<FiPlayCircle className="h-[18px] w-[18px]" strokeWidth={2} />}
            />
            <StatMiniCard
              label="Total de músicas"
              value={formatIntegerPtBR(totalMusics)}
              hint={`Visualizações: ${formatIntegerPtBR(musicViews)}`}
              tone="purple"
              icon={<FiMusic className="h-[18px] w-[18px]" strokeWidth={2} />}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
