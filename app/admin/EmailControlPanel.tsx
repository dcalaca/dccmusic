'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiChevronLeft, FiChevronRight, FiFilter, FiMail, FiRefreshCw, FiSearch, FiSend, FiUsers } from 'react-icons/fi'

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'
type SourceFilter = 'all' | 'transactional' | 'campaign'

type EmailRow = {
  id: string
  source: 'transactional' | 'campaign'
  category: string
  recipient: string
  sentAt: string
  campaignId?: string | null
}

type EmailSummary = {
  period: { startDate: string; endDate: string }
  totals: {
    total: number
    transactional: number
    campaigns: number
    uniqueRecipients: number
    activeDays: number
    averagePerActiveDay: number
    peakDay: string | null
    peakCount: number
  }
  series: Array<{ date: string; total: number; transactional: number; campaigns: number }>
  categories: Array<{ category: string; count: number }>
  recipients: Array<{ recipient: string; count: number }>
  rows: EmailRow[]
  meta: {
    fetchedRows: number
    pagination: string
    supabasePageSize: number
    campaignTableAvailable: boolean
    checkedAt: string
  }
}

const presetLabels: Record<Preset, string> = {
  today: 'Hoje',
  last7: 'Últimos 7 dias',
  last30: 'Últimos 30 dias',
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  custom: 'Personalizado',
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

function getPresetRange(preset: Preset) {
  const now = new Date()
  if (preset === 'today') return { startDate: dateToInput(now), endDate: dateToInput(now) }
  if (preset === 'last7') return { startDate: dateToInput(addDays(now, -6)), endDate: dateToInput(now) }
  if (preset === 'last30') return { startDate: dateToInput(addDays(now, -29)), endDate: dateToInput(now) }
  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { startDate: dateToInput(start), endDate: dateToInput(end) }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: dateToInput(start), endDate: dateToInput(now) }
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

function EmailDailyChart({ series }: { series: EmailSummary['series'] }) {
  const width = Math.max(900, series.length * 44)
  const height = 300
  const left = 54
  const right = 24
  const top = 24
  const bottom = 46
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const max = Math.max(1, ...series.map(item => item.total))
  const slot = innerWidth / Math.max(1, series.length)
  const line = series.map((item, index) => {
    const x = left + slot * index + slot / 2
    const y = top + innerHeight - (item.total / max) * innerHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  return (
    <div className="overflow-x-auto pb-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full" style={{ minWidth: Math.max(760, width * 0.72) }}>
        {[1, 0.75, 0.5, 0.25, 0].map(tick => {
          const y = top + innerHeight - tick * innerHeight
          return (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#1f2937" strokeDasharray={tick === 0 ? undefined : '4 7'} />
              <text x={left - 10} y={y + 4} textAnchor="end" className="fill-gray-500 text-[10px]">{Math.round(max * tick)}</text>
            </g>
          )
        })}

        {series.map((item, index) => {
          const x = left + slot * index + slot / 2
          const y = top + innerHeight - (item.total / max) * innerHeight
          const labelEvery = series.length > 20 ? Math.ceil(series.length / 10) : 1
          const showLabel = index % labelEvery === 0 || index === series.length - 1
          return (
            <g key={item.date}>
              <title>{`${formatDate(item.date)}\nTotal: ${item.total}\nTransacionais: ${item.transactional}\nCampanhas: ${item.campaigns}`}</title>
              <circle cx={x} cy={y} r="4" fill="#e879f9" />
              {showLabel && <text x={x} y={height - 20} textAnchor="middle" className="fill-gray-500 text-[9px]">{item.date.slice(5).split('-').reverse().join('/')}</text>}
            </g>
          )
        })}
        <path d={line} fill="none" stroke="#e879f9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function EmailControlPanel() {
  const [preset, setPreset] = useState<Preset>('thisMonth')
  const [range, setRange] = useState(() => getPresetRange('thisMonth'))
  const [summary, setSummary] = useState<EmailSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const rowsPerPage = 25

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/emails?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar gerenciador de e-mails')
      setSummary(data)
      setPage(1)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar gerenciador de e-mails')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectPreset = (nextPreset: Preset) => {
    setPreset(nextPreset)
    setError('')
    if (nextPreset !== 'custom') setRange(getPresetRange(nextPreset))
  }

  const updateDate = (field: 'startDate' | 'endDate', value: string) => {
    setPreset('custom')
    setRange(current => ({ ...current, [field]: value }))
  }

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (summary?.rows || []).filter(row => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
      if (needle && !`${row.recipient} ${row.category} ${row.campaignId || ''}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [summary, sourceFilter, categoryFilter, search])

  useEffect(() => setPage(1), [sourceFilter, categoryFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const filteredTotals = useMemo(() => {
    const transactional = filteredRows.filter(row => row.source === 'transactional').length
    const campaigns = filteredRows.length - transactional
    return { total: filteredRows.length, transactional, campaigns }
  }, [filteredRows])

  return (
    <section className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800 rounded-2xl p-5 sm:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-fuchsia-300 mb-2"><FiMail className="w-4 h-4" />Gerenciador de e-mails</div>
          <h1 className="text-2xl font-bold">Central de e-mails da DCC</h1>
          <p className="text-gray-400 text-sm mt-1">Volume, histórico, filtros, destinatários e campanhas em uma única tela.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/email-campanhas" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-fuchsia-900/70 bg-fuchsia-950/30 text-fuchsia-200 hover:border-fuchsia-500 transition-colors"><FiSend className="w-4 h-4" />Campanhas</Link>
          <button type="button" onClick={loadSummary} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-60"><FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(presetLabels) as Preset[]).map(item => (
          <button key={item} type="button" onClick={() => selectPreset(item)} className={`text-sm underline-offset-4 transition-colors ${preset === item ? 'text-fuchsia-300 underline' : 'text-gray-400 hover:text-fuchsia-300 hover:underline'}`}>{presetLabels[item]}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-3 mb-6">
        <label className="block"><span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Data inicial</span><input type="date" value={range.startDate} onChange={event => updateDate('startDate', event.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500" /></label>
        <label className="block"><span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Data final</span><input type="date" value={range.endDate} onChange={event => updateDate('endDate', event.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500" /></label>
        <button type="button" onClick={loadSummary} className="self-end px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium">Aplicar período</button>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800 text-red-200 rounded-lg p-4 mb-6 text-sm">{error}</div>}

      {!summary ? (
        <div className="border border-gray-800 rounded-xl p-6 text-gray-400 text-sm">{loading ? 'Carregando gerenciador de e-mails...' : 'Nenhum dado carregado.'}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-gray-950/70 border border-fuchsia-900/60 rounded-xl p-4"><p className="text-xs text-gray-400">Total enviado</p><p className="text-2xl font-bold text-fuchsia-300 mt-1">{formatNumber(summary.totals.total)}</p></div>
            <div className="bg-gray-950/70 border border-blue-900/60 rounded-xl p-4"><p className="text-xs text-gray-400">Transacionais</p><p className="text-2xl font-bold text-blue-300 mt-1">{formatNumber(summary.totals.transactional)}</p></div>
            <div className="bg-gray-950/70 border border-purple-900/60 rounded-xl p-4"><p className="text-xs text-gray-400">Campanhas</p><p className="text-2xl font-bold text-purple-300 mt-1">{formatNumber(summary.totals.campaigns)}</p></div>
            <div className="bg-gray-950/70 border border-cyan-900/60 rounded-xl p-4"><p className="text-xs text-gray-400">Destinatários únicos</p><p className="text-2xl font-bold text-cyan-300 mt-1">{formatNumber(summary.totals.uniqueRecipients)}</p></div>
            <div className="bg-gray-950/70 border border-green-900/60 rounded-xl p-4"><p className="text-xs text-gray-400">Pico diário</p><p className="text-2xl font-bold text-green-300 mt-1">{formatNumber(summary.totals.peakCount)}</p><p className="text-[11px] text-gray-500 mt-1">{formatDate(summary.totals.peakDay)}</p></div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-6">
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold">Quantidade enviada por dia</h2><p className="text-xs text-gray-500 mt-1">Média em dias ativos: {summary.totals.averagePerActiveDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} e-mails/dia</p></div><span className="text-xs text-gray-500">{summary.totals.activeDays} dia(s) com envio</span></div>
              <EmailDailyChart series={summary.series} />
            </div>

            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-semibold">Top tipos</h2><span className="text-xs text-gray-500">{summary.categories.length} tipo(s)</span></div>
              <div className="space-y-2 max-h-[330px] overflow-y-auto pr-1">
                {summary.categories.slice(0, 15).map(item => (
                  <button key={item.category} type="button" onClick={() => setCategoryFilter(item.category)} className="w-full flex items-center justify-between gap-3 border border-gray-800 rounded-lg px-3 py-2 text-left hover:border-fuchsia-800 transition-colors"><span className="text-xs text-gray-300 break-all">{item.category}</span><span className="font-semibold text-sm">{formatNumber(item.count)}</span></button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4"><FiFilter className="w-4 h-4 text-fuchsia-300" /><h2 className="font-semibold">Filtros do histórico</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label><span className="block text-xs text-gray-500 mb-1">Origem</span><select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as SourceFilter)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"><option value="all">Todos</option><option value="transactional">Transacionais</option><option value="campaign">Campanhas</option></select></label>
              <label><span className="block text-xs text-gray-500 mb-1">Tipo</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"><option value="all">Todos os tipos</option>{summary.categories.map(item => <option key={item.category} value={item.category}>{item.category} ({item.count})</option>)}</select></label>
              <label className="md:col-span-2"><span className="block text-xs text-gray-500 mb-1">Buscar destinatário, tipo ou campanha</span><div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ex.: suporte@dccmusic.online" className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500" /></div></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500"><span>Resultado: <strong className="text-white">{formatNumber(filteredTotals.total)}</strong></span><span>Transacionais: {formatNumber(filteredTotals.transactional)}</span><span>Campanhas: {formatNumber(filteredTotals.campaigns)}</span>{(sourceFilter !== 'all' || categoryFilter !== 'all' || search) && <button type="button" onClick={() => { setSourceFilter('all'); setCategoryFilter('all'); setSearch('') }} className="text-fuchsia-300 underline">Limpar filtros</button>}</div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-800"><div><h2 className="font-semibold">Histórico de envios</h2><p className="text-xs text-gray-500 mt-1">{formatNumber(filteredRows.length)} envio(s) encontrados</p></div><span className="text-xs text-gray-500">25 por página</span></div>
              <div className="divide-y divide-gray-800">
                {visibleRows.length ? visibleRows.map(row => (
                  <div key={`${row.source}-${row.id}`} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${row.source === 'campaign' ? 'border-purple-800 text-purple-300 bg-purple-950/30' : 'border-blue-800 text-blue-300 bg-blue-950/30'}`}>{row.source === 'campaign' ? 'Campanha' : 'Transacional'}</span><span className="text-xs text-gray-500 break-all">{row.category}</span></div><p className="text-sm text-gray-200 mt-2 break-all">{row.recipient}</p>{row.campaignId && <p className="text-[11px] text-gray-600 mt-1">Campanha: {row.campaignId}</p>}</div>
                    <div className="text-xs text-gray-500 md:text-right whitespace-nowrap">{formatDateTime(row.sentAt)}</div>
                  </div>
                )) : <div className="p-6 text-sm text-gray-500">Nenhum envio corresponde aos filtros.</div>}
              </div>
              {totalPages > 1 && <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-800"><button type="button" disabled={currentPage === 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="p-2 rounded-lg border border-gray-800 disabled:opacity-40"><FiChevronLeft /></button><span className="text-sm text-gray-400">Página {currentPage} de {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))} className="p-2 rounded-lg border border-gray-800 disabled:opacity-40"><FiChevronRight /></button></div>}
            </div>

            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3"><FiUsers className="w-4 h-4 text-cyan-300" /><h2 className="font-semibold">Destinatários com mais envios</h2></div>
              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {summary.recipients.slice(0, 30).map(item => <button key={item.recipient} type="button" onClick={() => setSearch(item.recipient)} className="w-full flex items-center justify-between gap-3 border border-gray-800 rounded-lg px-3 py-2 text-left hover:border-cyan-800 transition-colors"><span className="text-xs text-gray-300 break-all">{item.recipient}</span><span className="font-semibold text-sm">{formatNumber(item.count)}</span></button>)}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-green-900/40 bg-green-950/10 px-4 py-3 text-xs text-gray-400">
            O gerenciador pagina internamente as consultas ao Supabase em blocos de {summary.meta.supabasePageSize} registros e soma todas as páginas. Neste período foram carregados <strong className="text-green-300">{formatNumber(summary.meta.fetchedRows)} envios</strong>; portanto o painel não fica limitado aos primeiros 1.000 registros.
          </div>
        </>
      )}
    </section>
  )
}
