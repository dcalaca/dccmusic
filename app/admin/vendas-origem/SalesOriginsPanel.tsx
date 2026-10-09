'use client'

import { useEffect, useMemo, useState } from 'react'
import { OriginSale, summarizeOrigins } from '@/lib/sales-origins'

function day(offset = 0) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + offset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(value)
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
}
function amountsText(amounts: Record<string, number>) {
  return Object.entries(amounts).map(([currency, amount]) => money(amount, currency)).join(' • ')
}

export default function SalesOriginsPanel() {
  const [startDate, setStartDate] = useState(day())
  const [endDate, setEndDate] = useState(day())
  const [period, setPeriod] = useState({ startDate: day(), endDate: day(), revision: 0 })
  const [rows, setRows] = useState<OriginSale[]>([])
  const [origin, setOrigin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setRows([]); setPage(1)
    fetch(`/api/admin/reports/sales-origins?${new URLSearchParams({ startDate: period.startDate, endDate: period.endDate })}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar as vendas.')
        setRows(result.rows)
      }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [period])

  const groups = useMemo(() => summarizeOrigins(rows), [rows])
  const filtered = useMemo(() => rows.filter(row => !origin || row.origin === origin), [rows, origin])
  const totals = useMemo(() => {
    const amounts: Record<string, number> = {}
    for (const row of filtered) amounts[row.currency] = (amounts[row.currency] || 0) + row.amount
    return amountsText(amounts)
  }, [filtered])
  const pages = Math.max(1, Math.ceil(filtered.length / 50))

  function preset(offset: number) {
    const start = day(offset), end = day(offset === -1 ? -1 : 0)
    setStartDate(start); setEndDate(end); setOrigin('')
    setPeriod({ startDate: start, endDate: end, revision: period.revision + 1 })
  }
  function download() {
    const escape = (value: unknown) => {
      const text = String(value ?? '')
      return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
    }
    const csv = [['Data', 'Nome', 'E-mail', 'Origem', 'Origem registrada', 'Mídia', 'Campanha', 'Produto', 'Valor', 'Moeda'], ...filtered.map(row => [row.paidAt, row.buyer, row.email, row.origin, row.rawSource, row.medium, row.campaign, row.product, row.amount, row.currency])].map(row => row.map(escape).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `vendas-origem-${period.startDate}-${period.endDate}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const control = 'rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white'
  return <div className="mt-6 space-y-6">
    <div><h1 className="text-3xl font-bold">Vendas por origem</h1><p className="mt-2 text-gray-400">Consulte de onde vieram as compras aprovadas. Datas no horário de Brasília.</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setOrigin(''); setPeriod({ startDate, endDate, revision: period.revision + 1 }) }}>
      <label className="flex flex-col gap-1">De<input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} className={control} /></label>
      <label className="flex flex-col gap-1">Até<input type="date" required value={endDate} onChange={event => setEndDate(event.target.value)} className={control} /></label>
      <button className="rounded-lg bg-primary-600 px-4 py-2 font-semibold" disabled={loading}>Consultar</button>
      <button type="button" className={control} onClick={() => preset(0)}>Hoje</button>
      <button type="button" className={control} onClick={() => preset(-1)}>Ontem</button>
      <button type="button" className={control} onClick={() => preset(-29)}>Últimos 30 dias</button>
    </form>
    <p className="text-sm text-gray-400">A origem é a registrada na compra. “Acesso direto” significa acesso sem indicação de outro canal; “Não identificada” significa ausência de rastreamento. Destaques e vídeos antigos sem origem ficam como não identificados. Valores de moedas diferentes aparecem separados.</p>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-300">{error}</p>}
    {loading ? <p role="status">Consultando vendas…</p> : !error && <>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div><p className="text-2xl font-bold">{filtered.length} vendas</p><p className="text-gray-300">{totals || 'Nenhuma receita no período'}</p></div>
        <label>Origem <select className={control} value={origin} onChange={event => { setOrigin(event.target.value); setPage(1) }}><option value="">Todas</option>{groups.map(group => <option key={group.origin}>{group.origin}</option>)}</select></label>
        <button className={control} onClick={download} disabled={!filtered.length}>Exportar CSV</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800"><table className="w-full text-left"><caption className="sr-only">Resumo por origem</caption><thead className="bg-gray-900"><tr><th className="p-3">Origem</th><th className="p-3">Vendas</th><th className="p-3">Participação</th><th className="p-3">Valor</th></tr></thead><tbody>{groups.filter(group => !origin || group.origin === origin).map(group => <tr key={group.origin} className="border-t border-gray-800"><td className="p-3"><button className="text-primary-400" onClick={() => { setOrigin(group.origin); setPage(1) }}>{group.origin}</button></td><td className="p-3">{group.count}</td><td className="p-3">{(group.count / rows.length * 100).toFixed(1)}%</td><td className="p-3">{amountsText(group.amounts)}</td></tr>)}</tbody></table></div>
      <h2 className="text-xl font-semibold">Detalhes das vendas</h2>
      {!filtered.length ? <p className="text-gray-400">Nenhuma venda encontrada neste período.</p> : <>
        <div className="overflow-x-auto rounded-xl border border-gray-800"><table className="w-full text-left text-sm"><thead className="bg-gray-900"><tr>{['Data', 'Cliente', 'Origem', 'Campanha / Mídia', 'Produto', 'Valor'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 50, page * 50).map(row => <tr key={row.id} className="border-t border-gray-800"><td className="whitespace-nowrap p-3">{new Date(row.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td className="p-3">{row.buyer}<div className="text-gray-400">{row.email}</div></td><td className="p-3">{row.origin}<div className="text-gray-500">{row.rawSource}</div></td><td className="p-3">{row.campaign || '—'}<div className="text-gray-400">{row.medium}</div></td><td className="p-3">{row.product}</td><td className="whitespace-nowrap p-3">{money(row.amount, row.currency)}</td></tr>)}</tbody></table></div>
        <div className="flex items-center gap-4"><button className={control} disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button className={control} disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div>
      </>}
    </>}
  </div>
}
