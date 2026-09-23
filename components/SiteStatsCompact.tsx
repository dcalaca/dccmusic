import { FiMessageCircle, FiMusic, FiPlayCircle, FiUsers, FiZap } from 'react-icons/fi'
import { createDccI18n } from '@/i18n/i18next'

type AiMusicDay = {
  date: string
  label: string
  deliveredMusics: number
}

export type SiteStatsCompactProps = {
  locale?: string
  totalVideos: number
  videoViews: number
  totalMusics: number
  musicViews: number
  totalComposers?: number
  totalComments?: number
  totalRatings?: number
  deliveredAiMusics?: number
  aiMusicDays?: AiMusicDay[]
}

export default async function SiteStatsCompact({
  locale = 'pt-BR',
  totalVideos,
  videoViews,
  totalMusics,
  musicViews,
  totalComposers = 0,
  totalComments = 0,
  totalRatings = 0,
  deliveredAiMusics = 0,
  aiMusicDays = [],
}: SiteStatsCompactProps) {
  const i18n = await createDccI18n(locale)
  const t = i18n.t.bind(i18n)
  const totalInteractions = totalComments + totalRatings
  const maxAiDay = Math.max(1, ...aiMusicDays.map((day) => day.deliveredMusics))
  const formatInteger = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)

  return (
    <section className="overflow-hidden bg-black py-8 sm:py-12">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl min-w-0">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-300">{t('siteStats.badge')}</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              {t('siteStats.title')}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-400">
              {t('siteStats.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-purple-900/70 bg-gradient-to-br from-gray-950 via-purple-950/35 to-gray-950 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-purple-300">
                  {t('siteStats.createdSongs')}
                </p>
                <p className="mt-1 text-3xl font-black leading-none text-white tabular-nums sm:text-4xl">
                  {formatInteger(deliveredAiMusics)}
                </p>
                <p className="mt-2 text-[11px] lowercase text-gray-500">{t('siteStats.realtime')}</p>
              </div>
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-950 text-purple-300 ring-1 ring-purple-500/30"
                aria-hidden
              >
                <FiZap className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-green-900/70 bg-gray-950 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">{t('siteStats.community')}</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums sm:text-3xl">
                  {formatInteger(totalComposers)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {t('siteStats.songwriters')}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-950 text-green-300 sm:h-10 sm:w-10" aria-hidden>
                <FiUsers className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-yellow-900/70 bg-gray-950 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">{t('siteStats.interactions')}</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums sm:text-3xl">
                  {formatInteger(totalInteractions)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {t('siteStats.commentsRatings', { comments: formatInteger(totalComments), ratings: formatInteger(totalRatings) })}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-950 text-yellow-300 sm:h-10 sm:w-10" aria-hidden>
                <FiMessageCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>
          </div>

          {aiMusicDays.length > 0 && (
            <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-purple-900/70 bg-gradient-to-br from-purple-950/45 via-gray-950 to-black p-3 sm:p-5">
              <div className="mb-4 min-w-0">
                <h3 className="text-lg font-black text-white">{t('siteStats.aiDelivered')}</h3>
                <p className="mt-1 text-xs text-gray-400 sm:text-sm">{t('siteStats.last14Days')}</p>
              </div>

              <div className="flex h-36 min-w-0 items-end gap-1 border-b border-gray-800 px-0.5 pb-2 sm:h-44 sm:gap-2 sm:px-1">
                {aiMusicDays.map((day) => {
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
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-cyan-900/70 bg-gray-950 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">{t('siteStats.totalVideos')}</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                  {formatInteger(totalVideos)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {t('siteStats.views', { count: formatInteger(videoViews) })}
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
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:text-xs">{t('siteStats.totalMusics')}</p>
                <p className="mt-1 text-2xl font-black leading-tight text-white tabular-nums">
                  {formatInteger(totalMusics)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 tabular-nums sm:text-xs">
                  {t('siteStats.views', { count: formatInteger(musicViews) })}
                </p>
              </div>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-950 text-primary-300 sm:h-10 sm:w-10"
                aria-hidden
              >
                <FiMusic className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
