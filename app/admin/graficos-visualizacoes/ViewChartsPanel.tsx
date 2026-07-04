'use client'

import { useMemo, useState } from 'react'
import { FiCalendar, FiEye, FiRefreshCw } from 'react-icons/fi'

type RankingItem = {
  id: string
  title: string
  slug: string
  views: number
}

type ViewChartsSummary = {
  period: {
    startDate: string
    endDate: string
  }
  musics: RankingItem[]
  videos: RankingItem[]
  totals: {
    musicViews: number
    videoViews: number
  }
}

function dateToInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDefaultRange() {
  const now = new Date()
  return {
    startDate: dateToInput(addDays(now, -29)),
    endDate: dateToInput(now),
  }
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function RankingBarChart({
  title,
  description,
  emptyMessage,
  data,
  colorClass,
  selectedId,
  onSelect,
}: {
  title: string
  description: string
  emptyMessage: string
  data: RankingItem[]
  colorClass: string
  selectedId: string | null
  onSelect: (item: RankingItem) => void
}) {
  const maxViews = Math.max(1, ...data.map(item => item.views))

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-black/30 p-5 text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => {
            const width = Math.max(4, (item.views / maxViews) * 100)
            const isSelected = selectedId === item.id
            const tooltip = `${index + 1}º - ${item.title}: ${formatNumber(item.views)} visualização${item.views === 1 ? '' : 'ões'}`

            return (
              <button
                key={item.id}
                type="button"
                title={tooltip}
                onClick={() => onSelect(item)}
                className={`group block w-full rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-primary-400 bg-primary-950/30'
                    : 'border-gray-800 bg-black/30 hover:border-gray-600'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {index + 1}. {item.title}
                    </p>
                    {item.slug && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-600">/{item.slug}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-black text-white tabular-nums">
                    {formatNumber(item.views)}
                  </span>
                </div>
                <div className="h-8 overflow-hidden rounded-lg bg-gray-900 ring-1 ring-gray-800">
                  <div
                    className={`h-full rounded-lg ${colorClass} transition-all group-hover:brightness-110`}
                    style={{ width: `${width}%` }}
                    aria-label={tooltip}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TotalCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatNumber(value)}</p>
    </div>
  )
}

export default function ViewChartsPanel() {
  const [range, setRange] = useState(getDefaultRange)
  const [summary, setSummary] = useState<ViewChartsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ type: 'music' | 'video'; item: RankingItem } | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const loadCharts = async () => {
    try {
      setLoading(true)
      setError('')
      setSelected(null)
      const response = await fetch(`/api/admin/view-charts?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao consultar gráficos')
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar gráficos')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const resetResults = () => {
    setSummary(null)
    setSelected(null)
    setError('')
  }

  return (
    <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-bold text-primary-300">
            <FiEye className="h-4 w-4" />
            Gráficos de visualizações
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Rankings por período</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Escolha as datas e clique em Consultar. A página não calcula nada ao abrir.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCharts}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:border-primary-400 hover:text-primary-300 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <FiCalendar className="h-3 w-3" />
            Data inicial
          </span>
          <input
            type="date"
            value={range.startDate}
            onChange={event => {
              setRange(prev => ({ ...prev, startDate: event.target.value }))
              resetResults()
            }}
            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <FiCalendar className="h-3 w-3" />
            Data final
          </span>
          <input
            type="date"
            value={range.endDate}
            onChange={event => {
              setRange(prev => ({ ...prev, endDate: event.target.value }))
              resetResults()
            }}
            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Consultando visualizações...
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Defina o período e clique em Consultar para carregar os rankings.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TotalCard label="Visualizações em músicas no período" value={summary.totals.musicViews} />
            <TotalCard label="Visualizações em vídeos no período" value={summary.totals.videoViews} />
          </div>

          {selected && (
            <div className="rounded-xl border border-primary-800 bg-primary-950/20 p-4 text-sm text-primary-100">
              {selected.type === 'music' ? 'Música' : 'Vídeo'} selecionado: <strong>{selected.item.title}</strong> teve{' '}
              <strong>{formatNumber(selected.item.views)}</strong> visualização{selected.item.views === 1 ? '' : 'ões'} no período.
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <RankingBarChart
              title="Músicas mais ouvidas"
              description="Ranking das músicas com mais visualizações dentro do período consultado."
              emptyMessage="Nenhuma visualização de música encontrada nesse período."
              data={summary.musics}
              colorClass="bg-gradient-to-r from-primary-600 to-fuchsia-500"
              selectedId={selected?.type === 'music' ? selected.item.id : null}
              onSelect={item => setSelected({ type: 'music', item })}
            />
            <RankingBarChart
              title="Vídeos mais vistos"
              description="Ranking dos vídeos com mais visualizações dentro do período consultado."
              emptyMessage="Nenhuma visualização de vídeo encontrada nesse período."
              data={summary.videos}
              colorClass="bg-gradient-to-r from-cyan-500 to-blue-500"
              selectedId={selected?.type === 'video' ? selected.item.id : null}
              onSelect={item => setSelected({ type: 'video', item })}
            />
          </div>
        </div>
      )}
    </section>
  )
}
