'use client'

import { useMemo, useState } from 'react'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'

type ChartDay = {
  date: string
  label: string
  musicRequestsCompleted: number
  lyricsCreated: number
  coversDefault: number
  coversPremium: number
  coversCustom: number
  voicesUploaded: number
  voicesCompleted: number
  composerRegistrations: number
  siteUserRegistrations: number
  totalRegistrations: number
}

type ChartsSummary = {
  period: {
    startDate: string
    endDate: string
  }
  days: ChartDay[]
  totals: Omit<ChartDay, 'date' | 'label'>
  warnings: string[]
}

type SeriesConfig = {
  key: keyof ChartDay
  label: string
  color: string
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

function getNumericValue(day: ChartDay, key: keyof ChartDay) {
  const value = day[key]
  return typeof value === 'number' ? value : 0
}

function DailyStackedBarChart({
  title,
  description,
  data,
  series,
}: {
  title: string
  description: string
  data: ChartDay[]
  series: SeriesConfig[]
}) {
  const maxValue = Math.max(1, ...data.map(day => (
    series.reduce((total, item) => total + getNumericValue(day, item.key), 0)
  )))
  const labelEvery = Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {series.map(item => (
            <span key={String(item.key)} className="inline-flex items-center gap-1 text-gray-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex h-80 min-w-[980px] items-end gap-2 border-b border-gray-800 px-3">
          {data.map((day, index) => {
            const total = series.reduce((sum, item) => sum + getNumericValue(day, item.key), 0)
            const tooltip = [
              `${day.label}: ${formatNumber(total)} total`,
              ...series.map(item => `${item.label}: ${formatNumber(getNumericValue(day, item.key))}`),
            ].join('\n')

            return (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className="flex h-64 w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-lg bg-gray-900/90 ring-1 ring-gray-800/80 transition-opacity hover:opacity-90"
                  title={tooltip}
                >
                  {series.map(item => {
                    const value = getNumericValue(day, item.key)
                    const height = value > 0 ? Math.max(2, (value / maxValue) * 100) : 0
                    return (
                      <div
                        key={String(item.key)}
                        className="w-full"
                        style={{ height: `${height}%`, backgroundColor: item.color }}
                        aria-label={`${day.label} - ${item.label}: ${value}`}
                      />
                    )
                  })}
                </div>
                <span className="h-3 text-[10px] text-gray-700">
                  {index % labelEvery === 0 || index === data.length - 1 ? day.label : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StackedCoversChart({ data }: { data: ChartDay[] }) {
  const segments = [
    { key: 'coversDefault' as const, label: 'Padrão', color: '#38bdf8' },
    { key: 'coversPremium' as const, label: 'Premium', color: '#a855f7' },
    { key: 'coversCustom' as const, label: 'Personalizada', color: '#f59e0b' },
  ]

  return (
    <DailyStackedBarChart
      title="Capas por dia"
      description="Barra empilhada: padrão, premium e personalizada."
      data={data}
      series={segments}
    />
  )
}

function TotalCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

export default function AdminChartsPanel() {
  const [range, setRange] = useState(getDefaultRange)
  const [summary, setSummary] = useState<ChartsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      const response = await fetch(`/api/admin/charts?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar gráficos')
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar gráficos')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-primary-300">Gráficos do admin</p>
          <h1 className="mt-2 text-3xl font-black text-white">Produção, capas, vozes e cadastros</h1>
          <p className="mt-2 text-sm text-gray-400">
            Músicas contam solicitações concluídas, não as 2 versões geradas em cada pedido.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCharts}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:border-primary-400 hover:text-primary-300 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
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
              setSummary(null)
              setError('')
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
              setSummary(null)
              setError('')
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
          Carregando gráficos...
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Escolha as datas e clique em Atualizar para carregar os gráficos.
        </div>
      ) : summary ? (
        <div className="space-y-5">
          {summary.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm text-yellow-200">
              Algumas consultas não retornaram dados: {summary.warnings.join(' | ')}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <TotalCard label="Músicas concluídas" value={summary.totals.musicRequestsCompleted} hint="Solicitações, sem duplicar versões" />
            <TotalCard label="Letras feitas" value={summary.totals.lyricsCreated} hint="Registros em letras do Studio" />
            <TotalCard label="Capas feitas" value={summary.totals.coversDefault + summary.totals.coversPremium + summary.totals.coversCustom} hint="Padrão + premium + personalizada" />
            <TotalCard label="Vozes concluídas" value={summary.totals.voicesCompleted} hint="Status ready e disponível" />
            <TotalCard label="Cadastros" value={summary.totals.totalRegistrations} hint="Compositores + usuários do site" />
          </div>

          <DailyStackedBarChart
            title="Músicas concluídas por dia"
            description="Cada barra é uma solicitação finalizada em studio_generations."
            data={summary.days}
            series={[{ key: 'musicRequestsCompleted', label: 'Solicitações concluídas', color: '#22c55e' }]}
          />

          <DailyStackedBarChart
            title="Letras feitas por dia"
            description="Quantidade diária de letras salvas no Studio IA."
            data={summary.days}
            series={[{ key: 'lyricsCreated', label: 'Letras', color: '#38bdf8' }]}
          />

          <StackedCoversChart data={summary.days} />

          <DailyStackedBarChart
            title="Vozes subidas e concluídas"
            description="Subidas contam áudio base enviado; concluídas contam vozes verificadas e disponíveis."
            data={summary.days}
            series={[
              { key: 'voicesUploaded', label: 'Subidas', color: '#f59e0b' },
              { key: 'voicesCompleted', label: 'Concluídas', color: '#22c55e' },
            ]}
          />

          <DailyStackedBarChart
            title="Cadastros por dia"
            description="Mostra compositores e usuários comuns cadastrados no site."
            data={summary.days}
            series={[
              { key: 'composerRegistrations', label: 'Compositores', color: '#a855f7' },
              { key: 'siteUserRegistrations', label: 'Usuários do site', color: '#38bdf8' },
            ]}
          />
        </div>
      ) : null}
    </section>
  )
}
