'use client'

import { useState } from 'react'
import { FiBarChart2, FiRefreshCw } from 'react-icons/fi'

type MonthRow = {
  month: string
  purchases: number | null
  revenue: number | null
  registrations: number | null
  averageTicket: number | null
  costs: number | null
  netProfit: number | null
  musics: number | null
  emails: number | null
  warnings: string[]
}
type Metric = 'purchases' | 'revenue' | 'registrations' | 'averageTicket' | 'costs' | 'netProfit' | 'musics' | 'emails'
const metrics: { key: Metric; label: string; money?: boolean; color: string }[] = [
  { key: 'purchases', label: 'Quantidade de compras', color: '#a78bfa' },
  { key: 'revenue', label: 'Valores recebidos', money: true, color: '#34d399' },
  { key: 'registrations', label: 'Usuários cadastrados', color: '#38bdf8' },
  { key: 'averageTicket', label: 'Ticket médio', money: true, color: '#fbbf24' },
  { key: 'costs', label: 'Valores gastos', money: true, color: '#fb923c' },
  { key: 'netProfit', label: 'Lucro líquido estimado', money: true, color: '#2dd4bf' },
  { key: 'musics', label: 'Músicas criadas', color: '#e879f9' },
  { key: 'emails', label: 'E-mails enviados', color: '#818cf8' },
]
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function monthShift(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
function monthList(start: string, end: string) {
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) throw new Error('Escolha um intervalo válido de meses.')
  const result: string[] = []
  for (let month = start; month <= end; month = monthShift(month, 1)) {
    if (result.length >= 36) throw new Error('Escolha até 36 meses por consulta.')
    result.push(month)
  }
  return result
}
function monthLabel(month: string) {
  return new Date(month + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' })
}
function format(value: number | null, money = false) {
  if (value == null) return 'Indisponível'
  return value.toLocaleString('pt-BR', money ? { style: 'currency', currency: 'BRL' } : { maximumFractionDigits: 0 })
}

function MonthlyChart({ rows, metric }: { rows: MonthRow[]; metric: typeof metrics[number] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const values = rows.map(row => row[metric.key]).filter((v): v is number => v != null)
  const low = Math.min(0, ...values)
  const high = Math.max(1, ...values)
  const width = 620, left = 78, right = 18, top = 20, bottom = 174
  const x = (i: number) => rows.length === 1 ? (left + width - right) / 2 : left + i * (width - left - right) / (rows.length - 1)
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top)
  const selectedRow = rows.find(row => row.month === selected) || rows[rows.length - 1]
  const total = values.length !== rows.length ? null : metric.key === 'averageTicket'
    ? (rows.reduce((sum, row) => sum + (row.purchases || 0), 0) > 0
      ? rows.reduce((sum, row) => sum + (row.revenue || 0), 0) / rows.reduce((sum, row) => sum + (row.purchases || 0), 0) : 0)
    : values.reduce((sum, value) => sum + value, 0)
  const paths: string[] = []
  let segment = ''
  rows.forEach((row, i) => {
    const value = row[metric.key]
    if (value == null) { if (segment) paths.push(segment); segment = ''; return }
    segment += (segment ? ' L ' : 'M ') + x(i) + ' ' + y(value)
  })
  if (segment) paths.push(segment)
  return (
    <figure className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 sm:p-5">
      <figcaption className="text-sm font-bold text-gray-200">{metric.label}</figcaption>
      <div className="mt-2 text-2xl font-black" style={{ color: metric.color }}>{format(total, metric.money)}</div>
      <p className="text-xs text-gray-500">{metric.key === 'averageTicket' ? 'Média por compra no intervalo' : 'Total do intervalo'}</p>
      <svg viewBox="0 0 620 218" role="img" aria-label={metric.label + ' por mês'} className="mt-3 w-full">
        {[low, (low + high) / 2, high].map((value, i) => (
          <g key={i}>
            <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#263244" strokeDasharray="4 5" />
            <text x={left - 9} y={y(value) + 4} textAnchor="end" fill="#94a3b8" fontSize="11">
              {new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
            </text>
          </g>
        ))}
        {low < 0 && <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#64748b" />}
        {paths.map((path, i) => <path key={i} d={path} fill="none" stroke={metric.color} strokeWidth="3" />)}
        {rows.map((row, i) => (
          <g key={row.month}>
            {row[metric.key] != null && (
              <g tabIndex={0} role="button" aria-label={monthLabel(row.month) + ': ' + format(row[metric.key], metric.money)}
                onFocus={() => setSelected(row.month)} onMouseEnter={() => setSelected(row.month)}
                onClick={() => setSelected(row.month)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(row.month) }}>
                <title>{monthLabel(row.month) + ': ' + format(row[metric.key], metric.money)}</title>
                <circle cx={x(i)} cy={y(row[metric.key]!)} r="12" fill="transparent" />
                <circle cx={x(i)} cy={y(row[metric.key]!)} r={selectedRow?.month === row.month ? 5 : 3.5} fill={metric.color} />
              </g>
            )}
            {(rows.length <= 12 || i % Math.ceil(rows.length / 10) === 0 || i === rows.length - 1) &&
              <text x={x(i)} y="202" textAnchor="middle" fill="#94a3b8" fontSize="11">{monthLabel(row.month)}</text>}
          </g>
        ))}
      </svg>
      <p className="min-h-5 text-xs text-gray-400">{selectedRow && monthLabel(selectedRow.month) + ': ' + format(selectedRow[metric.key], metric.money)}</p>
    </figure>
  )
}

export default function FinanceMonthlyPanel() {
  const currentMonth = todayKey().slice(0, 7)
  const [startMonth, setStartMonth] = useState(() => monthShift(currentMonth, -5))
  const [endMonth, setEndMonth] = useState(currentMonth)
  const [rows, setRows] = useState<MonthRow[]>([])
  const [applied, setApplied] = useState({ start: '', end: '' })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const load = async () => {
    if (loading) return
    setError('')
    let months: string[]
    try {
      months = monthList(startMonth, endMonth)
      if (endMonth > currentMonth) throw new Error('Escolha meses até o mês atual.')
    } catch (e: any) { setError(e.message); return }
    setLoading(true)
    setRows([])
    setWarnings([])
    try {
      const next: MonthRow[] = []
      const issues: string[] = []
      // Sequential requests keep the finance providers from being flooded.
      for (const [index, month] of months.entries()) {
        setProgress('Consultando ' + monthLabel(month) + ' (' + (index + 1) + '/' + months.length + ')')
        const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
        const params = new URLSearchParams({ monthly: '1', startDate: month + '-01', endDate: month === currentMonth ? todayKey() : lastDay })
        const response = await fetch('/api/admin/finance?' + params, { cache: 'no-store', signal: AbortSignal.timeout(120000) })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Não foi possível consultar ' + monthLabel(month) + '. Atualize a sessão e tente novamente.')
        const data = await response.json()
        next.push(data)
        for (const warning of data.warnings || []) issues.push(monthLabel(month) + ': ' + warning)
      }
      setRows(next)
      setApplied({ start: startMonth, end: endMonth })
      setWarnings(issues)
    } catch (e: any) {
      setError(e.name === 'TimeoutError' ? 'A consulta demorou demais. Tente novamente ou escolha menos meses.' : e.message || 'Erro ao consultar evolução mensal.')
    } finally { setLoading(false); setProgress('') }
  }
  return (
    <section id="evolucao-mensal" className="mb-8 scroll-mt-24 rounded-3xl border border-violet-900/70 bg-gradient-to-br from-violet-950/30 via-gray-900/60 to-black p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-white"><FiBarChart2 className="text-violet-400" /> Evolução mensal</h2>
          <p className="mt-2 text-sm text-gray-400">Compras, receita, cadastros, custos e produção mês a mês. Valores em reais.</p>
        </div>
        <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400">Todos os países</span>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-400">Mês inicial<input type="month" value={startMonth} max={currentMonth} disabled={loading} onChange={e => setStartMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-gray-400">Mês final<input type="month" value={endMonth} max={currentMonth} disabled={loading} onChange={e => setEndMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" /></label>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"><FiRefreshCw className={loading ? 'animate-spin' : ''} />{loading ? 'Consultando...' : 'Consultar meses'}</button>
        {[3, 6, 12].map(count => <button key={count} type="button" disabled={loading} onClick={() => { setStartMonth(monthShift(currentMonth, 1 - count)); setEndMonth(currentMonth) }} className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-violet-500 disabled:opacity-50">{count} meses</button>)}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
      {loading && <p role="status" className="mt-5 text-sm text-violet-300">{progress}</p>}
      {!loading && !rows.length && !error && <p className="mt-6 rounded-xl border border-gray-800 p-6 text-sm text-gray-400">Escolha o intervalo e clique em Consultar meses para carregar os oito gráficos.</p>}
      {!!rows.length && <>
        <p className="mt-5 text-xs text-gray-400">Exibindo {monthLabel(applied.start)} a {monthLabel(applied.end)}. O mês atual é parcial, até hoje.{(startMonth !== applied.start || endMonth !== applied.end) && ' Clique em Consultar meses para aplicar o novo intervalo.'}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{metrics.map(metric => <MonthlyChart key={metric.key} rows={rows} metric={metric} />)}</div>
        <details className="mt-5 rounded-xl border border-gray-800 p-4">
          <summary className="cursor-pointer text-sm font-bold text-gray-200">Ver números por mês</summary>
          <div className="mt-4 overflow-x-auto"><table className="min-w-[1100px] w-full text-left text-xs"><thead><tr className="text-gray-400"><th className="p-2">Mês</th>{metrics.map(metric => <th key={metric.key} className="p-2">{metric.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.month} className="border-t border-gray-800 text-gray-200"><td className="p-2 whitespace-nowrap">{monthLabel(row.month)}</td>{metrics.map(metric => <td key={metric.key} className="p-2 whitespace-nowrap">{format(row[metric.key], metric.money)}</td>)}</tr>)}</tbody></table></div>
        </details>
        <p className="mt-4 text-xs leading-relaxed text-gray-500">Ticket médio = receita ÷ compras. Lucro líquido estimado = receita − custos do painel financeiro (IA musical/criativa, vídeos, taxas de pagamento, anúncios Meta e serviços fixos proporcionais aos dias). Mantém as premissas atuais do painel; não representa lucro contábil. Músicas: criações com áudio pronto, sem somar versões. E-mails: envios transacionais e campanhas registrados, contados uma vez por envio.</p>
        {!!warnings.length && <details className="mt-3 rounded-lg border border-amber-900/60 p-3 text-xs text-amber-200"><summary className="cursor-pointer">Observações dos dados ({warnings.length})</summary><ul className="mt-2 space-y-1">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      </>}
    </section>
  )
}
