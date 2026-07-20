'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'

type ComparisonItem = {
  key: 'new' | 'recurring'
  label: string
  count: number
  amount: number
}

type KindSummary = {
  kind: 'new' | 'recurring'
  label: string
  count: number
  amount: number
  uniqueComposers: number
}

type SourceBreakdown = {
  source: string
  label: string
  newCount: number
  newAmount: number
  recurringCount: number
  recurringAmount: number
  totalCount: number
  totalAmount: number
}

type DayBucket = {
  date: string
  label: string
  newCount: number
  newAmount: number
  recurringCount: number
  recurringAmount: number
}

type PaymentTypesReport = {
  period: {
    startDate: string
    endDate: string
  }
  definitions: {
    new: string
    recurring: string
  }
  comparison: ComparisonItem[]
  kinds: KindSummary[]
  bySource: SourceBreakdown[]
  days: DayBucket[]
  totals: {
    count: number
    amount: number
    uniqueComposers: number
  }
  warnings: string[]
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

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function ComparisonChart({
  comparison,
}: {
  comparison: ComparisonItem[]
}) {
  const [selectedKey, setSelectedKey] = useState<'new' | 'recurring' | null>(null)
  const maxCount = Math.max(1, ...comparison.map(item => item.count))
  const maxAmount = Math.max(1, ...comparison.map(item => item.amount))
  const selected = selectedKey ? comparison.find(item => item.key === selectedKey) || null : null

  useEffect(() => {
    setSelectedKey(null)
  }, [comparison])

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-4">
        <h3 className="font-bold text-white">Novos x Recorrentes</h3>
        <p className="mt-1 text-xs text-gray-500">
          Eixo X: tipo de usuário. Barras mostram quantidade e valor.
        </p>
        <p className="mt-1 text-xs text-gray-600 sm:hidden">Toque em um grupo para ver os números.</p>
      </div>

      {selected && (
        <div className="mb-4 rounded-xl border border-cyan-800/70 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-50">
          <p className="font-bold text-white">{selected.label}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cyan-100">
            <span>Quantidade: <strong className="text-white">{formatNumber(selected.count)}</strong></span>
            <span>Valor: <strong className="text-white">{formatMoney(selected.amount)}</strong></span>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {comparison.map(item => {
          const countHeight = Math.max(item.count > 0 ? 8 : 0, (item.count / maxCount) * 100)
          const amountHeight = Math.max(item.amount > 0 ? 8 : 0, (item.amount / maxAmount) * 100)
          const isSelected = selectedKey === item.key
          const tooltip = `${item.label}\nQuantidade: ${formatNumber(item.count)}\nValor: ${formatMoney(item.amount)}`

          return (
            <button
              key={item.key}
              type="button"
              title={tooltip}
              aria-label={tooltip}
              aria-pressed={isSelected}
              onClick={() => setSelectedKey(prev => (prev === item.key ? null : item.key))}
              className={`rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-gray-800 bg-black/20 hover:border-gray-600'
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-bold text-white">{item.label}</p>
                <div className="flex gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Qtd
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Valor
                  </span>
                </div>
              </div>

              <div className="flex h-56 items-end justify-center gap-6 border-b border-gray-800 px-4 pb-2">
                <div className="flex h-full w-14 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-white">{formatNumber(item.count)}</span>
                  <div
                    className="w-full rounded-t-lg bg-sky-400"
                    style={{ height: `${countHeight}%` }}
                  />
                  <span className="text-[10px] text-gray-500">Qtd</span>
                </div>
                <div className="flex h-full w-14 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-white">{formatMoney(item.amount)}</span>
                  <div
                    className="w-full rounded-t-lg bg-emerald-400"
                    style={{ height: `${amountHeight}%` }}
                  />
                  <span className="text-[10px] text-gray-500">Valor</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DailyChart({ days }: { days: DayBucket[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const maxCount = Math.max(1, ...days.map(day => day.newCount + day.recurringCount))
  const labelEvery = Math.max(1, Math.ceil(days.length / 12))
  const selectedDay = selectedDate ? days.find(day => day.date === selectedDate) || null : null

  useEffect(() => {
    setSelectedDate(null)
  }, [days])

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-white">Quantidade por dia</h3>
          <p className="mt-1 text-xs text-gray-500">Barras empilhadas: novos (azul) e recorrentes (verde).</p>
          <p className="mt-1 text-xs text-gray-600 sm:hidden">Toque em uma barra para ver a quantidade e o valor.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Novos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Recorrentes
          </span>
        </div>
      </div>

      {selectedDay && (
        <div className="mb-4 rounded-xl border border-cyan-800/70 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-50">
          <p className="font-bold text-white">
            {selectedDay.label}: {formatNumber(selectedDay.newCount + selectedDay.recurringCount)} pagamentos
          </p>
          <div className="mt-2 grid gap-1 text-xs text-cyan-100 sm:grid-cols-2">
            <span>Novos: <strong className="text-white">{formatNumber(selectedDay.newCount)}</strong> · {formatMoney(selectedDay.newAmount)}</span>
            <span>Recorrentes: <strong className="text-white">{formatNumber(selectedDay.recurringCount)}</strong> · {formatMoney(selectedDay.recurringAmount)}</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex h-80 min-w-[980px] items-end gap-2 border-b border-gray-800 px-3">
          {days.map((day, index) => {
            const totalCount = day.newCount + day.recurringCount
            const tooltip = [
              `${day.label}: ${formatNumber(totalCount)} pagamentos`,
              `Novos: ${formatNumber(day.newCount)} (${formatMoney(day.newAmount)})`,
              `Recorrentes: ${formatNumber(day.recurringCount)} (${formatMoney(day.recurringAmount)})`,
            ].join('\n')
            const isSelected = selectedDate === day.date
            const newHeight = day.newCount > 0 ? Math.max(2, (day.newCount / maxCount) * 100) : 0
            const recurringHeight = day.recurringCount > 0 ? Math.max(2, (day.recurringCount / maxCount) * 100) : 0

            return (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <button
                  type="button"
                  title={tooltip}
                  aria-label={tooltip}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDate(prev => (prev === day.date ? null : day.date))}
                  className={`flex h-64 w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-lg bg-gray-900/90 ring-1 transition-all ${
                    isSelected
                      ? 'ring-2 ring-cyan-400 opacity-100'
                      : 'ring-gray-800/80 hover:opacity-90'
                  }`}
                >
                  <div className="w-full bg-emerald-400" style={{ height: `${recurringHeight}%` }} aria-hidden="true" />
                  <div className="w-full bg-sky-400" style={{ height: `${newHeight}%` }} aria-hidden="true" />
                </button>
                <span className="h-3 text-[10px] text-gray-700">
                  {index % labelEvery === 0 || index === days.length - 1 ? day.label : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-600">Eixo Y: quantidade de pagamentos no dia (máx. {formatNumber(maxCount)}).</p>
    </div>
  )
}

export default function PaymentTypesPanel() {
  const [range, setRange] = useState(getDefaultRange)
  const [report, setReport] = useState<PaymentTypesReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/reports/payment-types?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar tipos de pagamento')
      setReport(data)
    } catch (err: any) {
      setReport(null)
      setError(err.message || 'Erro ao carregar tipos de pagamento')
    } finally {
      setLoading(false)
    }
  }

  const clearResult = (key: 'startDate' | 'endDate', value: string) => {
    setRange(prev => ({ ...prev, [key]: value }))
    setReport(null)
    setError('')
  }

  const newKind = report?.kinds.find(item => item.kind === 'new')
  const recurringKind = report?.kinds.find(item => item.kind === 'recurring')

  return (
    <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-primary-300">Relatórios do admin</p>
          <h1 className="mt-2 text-3xl font-black text-white">Tipos de pagamento</h1>
          <p className="mt-2 text-sm text-gray-400">
            Separação entre usuário novo (primeiro pagamento) e recorrente (já pagou antes).
          </p>
        </div>
        <button
          type="button"
          onClick={loadReport}
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
          Calculando tipos de pagamento...
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Escolha as datas e clique em Calcular. A página não consulta nada automaticamente.
        </div>
      ) : (
        <div className="space-y-5">
          {report.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm text-yellow-200">
              {report.warnings.join(' | ')}
            </div>
          )}

          <div className="grid gap-4 rounded-2xl border border-gray-800 bg-black/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Pagamento novo</p>
              <p className="mt-2 text-sm text-gray-300">{report.definitions.new}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Pagamento recorrente</p>
              <p className="mt-2 text-sm text-gray-300">{report.definitions.recurring}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Pagamentos novos"
              value={formatNumber(newKind?.count || 0)}
              hint={formatMoney(newKind?.amount || 0)}
            />
            <SummaryCard
              label="Pagamentos recorrentes"
              value={formatNumber(recurringKind?.count || 0)}
              hint={formatMoney(recurringKind?.amount || 0)}
            />
            <SummaryCard
              label="Total de pagamentos"
              value={formatNumber(report.totals.count)}
              hint={formatMoney(report.totals.amount)}
            />
            <SummaryCard
              label="Usuários que pagaram"
              value={formatNumber(report.totals.uniqueComposers)}
              hint={`${formatNumber(newKind?.uniqueComposers || 0)} novos · ${formatNumber(recurringKind?.uniqueComposers || 0)} recorrentes`}
            />
          </div>

          <ComparisonChart comparison={report.comparison} />
          <DailyChart days={report.days} />

          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
            <h3 className="mb-4 font-bold text-white">Tabela resumo</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Quantidade</th>
                    <th className="px-3 py-2 font-semibold">Valor</th>
                    <th className="px-3 py-2 font-semibold">Usuários</th>
                  </tr>
                </thead>
                <tbody>
                  {report.kinds.map(item => (
                    <tr key={item.kind} className="border-b border-gray-900/80 text-gray-300">
                      <td className="px-3 py-3 font-medium text-white">{item.label}</td>
                      <td className="px-3 py-3">{formatNumber(item.count)}</td>
                      <td className="px-3 py-3">{formatMoney(item.amount)}</td>
                      <td className="px-3 py-3">{formatNumber(item.uniqueComposers)}</td>
                    </tr>
                  ))}
                  <tr className="text-white">
                    <td className="px-3 py-3 font-bold">Total</td>
                    <td className="px-3 py-3 font-bold">{formatNumber(report.totals.count)}</td>
                    <td className="px-3 py-3 font-bold">{formatMoney(report.totals.amount)}</td>
                    <td className="px-3 py-3 font-bold">{formatNumber(report.totals.uniqueComposers)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {report.bySource.length > 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="mb-4 font-bold text-white">Por origem do pagamento</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-semibold">Origem</th>
                      <th className="px-3 py-2 font-semibold">Novos (qtd)</th>
                      <th className="px-3 py-2 font-semibold">Novos (R$)</th>
                      <th className="px-3 py-2 font-semibold">Recorrentes (qtd)</th>
                      <th className="px-3 py-2 font-semibold">Recorrentes (R$)</th>
                      <th className="px-3 py-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bySource.map(item => (
                      <tr key={item.source} className="border-b border-gray-900/80 text-gray-300">
                        <td className="px-3 py-3 font-medium text-white">{item.label}</td>
                        <td className="px-3 py-3">{formatNumber(item.newCount)}</td>
                        <td className="px-3 py-3">{formatMoney(item.newAmount)}</td>
                        <td className="px-3 py-3">{formatNumber(item.recurringCount)}</td>
                        <td className="px-3 py-3">{formatMoney(item.recurringAmount)}</td>
                        <td className="px-3 py-3">
                          {formatNumber(item.totalCount)} · {formatMoney(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
