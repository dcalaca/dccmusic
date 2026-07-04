'use client'

import { useMemo, useState } from 'react'
import { FiBarChart2, FiCalendar, FiRefreshCw } from 'react-icons/fi'

type ProviderDay = {
  date: string
  label: string
  sunoapi: number
  mureka: number
  other: number
  total: number
}

type ProviderTotal = {
  provider: string
  label: string
  total: number
  completed: number
  processing: number
  firstReady: number
  failed: number
  versions: number
}

type ProviderReport = {
  period: {
    startDate: string
    endDate: string
  }
  days: ProviderDay[]
  providerTotals: ProviderTotal[]
  totals: Omit<ProviderTotal, 'provider' | 'label'>
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

function ProviderBadge({ provider, label }: { provider: string; label: string }) {
  const className = provider === 'sunoapi'
    ? 'border-green-700 bg-green-950/50 text-green-300'
    : provider === 'mureka'
      ? 'border-purple-700 bg-purple-950/50 text-purple-300'
      : 'border-gray-700 bg-gray-900 text-gray-300'

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function ProviderBarChart({ days }: { days: ProviderDay[] }) {
  const maxValue = Math.max(1, ...days.map(day => day.total))
  const labelEvery = Math.max(1, Math.ceil(days.length / 12))
  const series = [
    { key: 'sunoapi' as const, label: 'Suno', color: '#22c55e' },
    { key: 'mureka' as const, label: 'Mureka', color: '#a855f7' },
    { key: 'other' as const, label: 'Outros', color: '#64748b' },
  ]

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-white">Músicas por dia e fornecedor</h3>
          <p className="mt-1 text-xs text-gray-500">Barra empilhada com solicitações criadas no dia.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {series.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1 text-gray-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex h-80 min-w-[980px] items-end gap-2 border-b border-gray-800 px-3">
          {days.map((day, index) => {
            const tooltip = [
              `${day.label}: ${formatNumber(day.total)} total`,
              `Suno: ${formatNumber(day.sunoapi)}`,
              `Mureka: ${formatNumber(day.mureka)}`,
              `Outros: ${formatNumber(day.other)}`,
            ].join('\n')
            return (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className="flex h-64 w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-lg bg-gray-900/90 ring-1 ring-gray-800/80 transition-opacity hover:opacity-90"
                  title={tooltip}
                >
                  {series.map(item => {
                    const value = day[item.key]
                    const height = value > 0 ? Math.max(2, (value / maxValue) * 100) : 0
                    return (
                      <div
                        key={item.key}
                        className="w-full"
                        style={{ height: `${height}%`, backgroundColor: item.color }}
                        aria-label={`${day.label} - ${item.label}: ${value}`}
                      />
                    )
                  })}
                </div>
                <span className="h-3 text-[10px] text-gray-700">
                  {index % labelEvery === 0 || index === days.length - 1 ? day.label : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ProviderReportPanel() {
  const [range, setRange] = useState(getDefaultRange)
  const [report, setReport] = useState<ProviderReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const calculate = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/reports/providers?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao calcular relatório')
      setReport(data)
    } catch (err: any) {
      setReport(null)
      setError(err.message || 'Erro ao calcular relatório')
    } finally {
      setLoading(false)
    }
  }

  const clearResult = (key: 'startDate' | 'endDate', value: string) => {
    setRange(prev => ({ ...prev, [key]: value }))
    setReport(null)
    setError('')
  }

  return (
    <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-primary-300">Relatórios do admin</p>
          <h1 className="mt-2 text-3xl font-black text-white">Músicas por fornecedor</h1>
          <p className="mt-2 text-sm text-gray-400">
            Conta solicitações criadas no Studio IA e separa Suno, Mureka e outros fornecedores.
          </p>
        </div>
        <button
          type="button"
          onClick={calculate}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Calcular
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
            onChange={event => clearResult('startDate', event.target.value)}
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
            onChange={event => clearResult('endDate', event.target.value)}
            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Calculando relatório...
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Escolha as datas e clique em Calcular. A página não consulta nada automaticamente.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Solicitações" value={report.totals.total} hint="Pedidos de música criados" />
            <SummaryCard label="Concluídas" value={report.totals.completed} hint="Status completed" />
            <SummaryCard label="Versões salvas" value={report.totals.versions} hint="Faixas gravadas no sistema" />
            <SummaryCard label="Falhas" value={report.totals.failed} hint="Status failed" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/60">
            <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
              <FiBarChart2 className="h-4 w-4 text-primary-300" />
              <h2 className="font-bold text-white">Tabela por fornecedor</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-900/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Fornecedor</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Solicitações</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Concluídas</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Gerando</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Primeira pronta</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Falhas</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Versões salvas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {report.providerTotals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        Nenhuma música encontrada nesse período.
                      </td>
                    </tr>
                  ) : report.providerTotals.map(provider => (
                    <tr key={provider.provider} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <ProviderBadge provider={provider.provider} label={provider.label} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-white">{formatNumber(provider.total)}</td>
                      <td className="px-4 py-3 text-right text-sm text-green-300">{formatNumber(provider.completed)}</td>
                      <td className="px-4 py-3 text-right text-sm text-yellow-300">{formatNumber(provider.processing)}</td>
                      <td className="px-4 py-3 text-right text-sm text-blue-300">{formatNumber(provider.firstReady)}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-300">{formatNumber(provider.failed)}</td>
                      <td className="px-4 py-3 text-right text-sm text-primary-300">{formatNumber(provider.versions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ProviderBarChart days={report.days} />
        </div>
      )}
    </section>
  )
}
