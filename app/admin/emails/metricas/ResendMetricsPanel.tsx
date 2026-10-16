'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiCheckCircle, FiExternalLink, FiMail, FiRefreshCw } from 'react-icons/fi'
import { EmailMetrics, REPORT_PRESETS, ReportPreset, ReportRange, ResendReport, reportPresetRange } from '@/lib/resend-report'

const number = (value: number) => value.toLocaleString('pt-BR')
const percent = (part: number, total: number) => total ? `${(part / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'
const date = (value: string) => new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

function MetricCells({ metrics: m }: { metrics: EmailMetrics }) {
  return <>
    <td className="p-4 text-right tabular-nums font-semibold">{number(m.sent)}</td>
    <td className="p-4 text-right tabular-nums text-emerald-300">{number(m.delivered)}</td>
    <td className="p-4 text-right tabular-nums text-amber-300">{number(m.bounced)}</td>
    <td className="p-4 text-right tabular-nums text-red-300">{number(m.complained)}</td>
    <td className="p-4 text-right tabular-nums"><div>{number(m.unique_opened)}</div><div className="text-xs text-gray-500 whitespace-nowrap">{number(m.opened)} aberturas totais</div></td>
    <td className="p-4 text-right text-gray-500" title="O Resend não fornece confirmação de leitura. Abertura não comprova leitura.">—</td>
    <td className="p-4 text-right tabular-nums text-fuchsia-300"><div>{number(m.unique_clicked)}</div><div className="text-xs text-gray-500 whitespace-nowrap">{number(m.clicked)} cliques totais</div></td>
  </>
}
export default function ResendMetricsPanel() {
  const [preset, setPreset] = useState<ReportPreset>('thisMonth')
  const [range, setRange] = useState<ReportRange>(() => reportPresetRange('thisMonth'))
  const [report, setReport] = useState<ResendReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const controller = useRef<AbortController | null>(null)
  async function load(nextRange: ReportRange) {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setLoading(true); setError(''); setReport(null)
    try {
      const response = await fetch(`/api/admin/emails/metrics?${new URLSearchParams(nextRange)}`, { cache: 'no-store', signal: current.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o relatório.')
      if (!current.signal.aborted) setReport(data)
    } catch (err: any) { if (!current.signal.aborted) setError(err.message || 'Falha ao consultar métricas.') }
    finally { if (!current.signal.aborted) setLoading(false) }
  }
  useEffect(() => { load(reportPresetRange('thisMonth')); return () => controller.current?.abort() }, [])
  function selectPreset(value: ReportPreset) {
    setPreset(value)
    if (value !== 'custom') { const nextRange = reportPresetRange(value); setRange(nextRange); load(nextRange) }
  }
  const filtered = (report?.categories || []).filter(row => `${row.label} ${row.category}`.toLowerCase().includes(search.toLowerCase().trim()))
  const field = 'w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-white focus:border-fuchsia-500 focus:outline-none'
  return <main className="mx-auto max-w-[1500px] px-4 py-8 text-white sm:px-6">
    <div className="flex flex-wrap gap-5 text-sm"><Link href="/admin" className="inline-flex items-center gap-2 text-purple-300"><FiArrowLeft />Admin</Link><Link href="/admin/emails" className="text-gray-400 hover:text-white">Histórico de envios</Link><Link href="/admin/email-campanhas" className="text-gray-400 hover:text-white">Campanhas</Link><Link href="/admin/email-prospeccao" className="text-gray-400 hover:text-white">Prospecção</Link></div>
    <section className="mt-6 rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-950 to-black p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm text-fuchsia-300"><FiMail />DCC MUSIC · RESEND</p><h1 className="text-3xl font-bold">Controle de emails</h1><p className="mt-2 text-sm text-gray-400">Entregas e engajamento por tipo, consultados na API do Resend.</p></div><button onClick={() => load(range)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 text-sm disabled:opacity-50"><FiRefreshCw className={loading ? 'animate-spin' : ''} />Atualizar</button></div>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="Períodos">{(Object.keys(REPORT_PRESETS) as ReportPreset[]).map(value => <button key={value} onClick={() => selectPreset(value)} aria-pressed={preset === value} className={`rounded-xl border px-3 py-2 text-sm transition-colors ${preset === value ? 'border-fuchsia-500 bg-fuchsia-950 text-fuchsia-100' : 'border-gray-800 text-gray-400 hover:border-gray-600'}`}>{REPORT_PRESETS[value]}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); load(range) }} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-gray-400">De<input required type="date" value={range.startDate} onChange={event => { setPreset('custom'); setRange({ ...range, startDate: event.target.value }) }} className={`${field} mt-1`} /></label>
        <label className="text-xs text-gray-400">Até<input required type="date" value={range.endDate} onChange={event => { setPreset('custom'); setRange({ ...range, endDate: event.target.value }) }} className={`${field} mt-1`} /></label>
        <button disabled={loading} className="self-end rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold hover:bg-fuchsia-500 disabled:opacity-50">Aplicar período</button>
      </form><p className="mt-2 text-xs text-gray-500">Horário de Brasília · O Resend pode levar até 15 minutos para atualizar as métricas.</p>
    </section>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-200">{error}</div>}
    {loading && <div role="status" className="mt-6 flex items-center gap-3 rounded-2xl border border-gray-800 p-6 text-gray-400"><FiRefreshCw className="animate-spin" />Consultando métricas e identificando os tipos de email…</div>}
    {report && <>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="font-semibold">{date(report.range.startDate)} a {date(report.range.endDate)}</p><p className="inline-flex items-center gap-2 text-xs text-gray-500"><FiCheckCircle className="text-emerald-400" />Consultado em {dateTime(report.meta.checkedAt)}</p></div>
      {report.meta.retentionLimited && <p className="mb-4 rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm text-amber-200">O histórico disponível no plano do Resend começa em {dateTime(report.actualRange.start)}. Parte do período selecionado não está disponível.</p>}
      {report.meta.warnings.map(warning => <p key={warning} className="mb-3 rounded-xl border border-amber-900 p-3 text-sm text-amber-200">{warning}</p>)}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Enviados', value: number(report.totals.sent), detail: 'Enviados ao servidor de destino' },
        { label: 'Entregues', value: number(report.totals.delivered), detail: 'Aceitos pelo servidor de destino' },
        { label: 'Emails abertos', value: number(report.totals.unique_opened), detail: `${number(report.totals.opened)} aberturas totais` },
        { label: 'Emails com clique', value: number(report.totals.unique_clicked), detail: `${number(report.totals.clicked)} cliques totais` },
      ].map(card => <div key={card.label} className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4"><p className="text-sm text-gray-400">{card.label}</p><p className="my-1 text-3xl font-bold text-fuchsia-200">{card.value}</p><p className="text-xs text-gray-500">{card.detail}</p></div>)}</div>
      <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-lg font-semibold">Resultado por tipo</h2><label className="flex w-full flex-col gap-1 text-sm text-gray-400 sm:w-auto sm:flex-row sm:items-center sm:gap-2">Buscar tipo<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: música pronta" className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-white sm:w-auto" /></label></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-900 text-xs uppercase text-gray-400"><tr><th scope="col" className="p-4 text-left">Tipo</th>{['Enviados', 'Entregues', 'Bounce', 'Spam', 'Aberto (únicos)', 'Leitura', 'Clique (únicos)'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-4 text-right">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-800">{filtered.map(row => <tr key={row.category} className="hover:bg-gray-900/70"><th scope="row" className="min-w-[210px] p-4 text-left font-medium"><div>{row.label}</div><div className="mt-1 text-xs font-normal text-gray-600">{row.category}</div></th><MetricCells metrics={row.metrics} /></tr>)}{!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-gray-500">{report.categories.length ? 'Nenhum tipo corresponde à busca.' : 'Nenhum evento disponível neste período.'}</td></tr>}</tbody><tfoot className="border-t border-fuchsia-900 bg-fuchsia-950/20"><tr><th scope="row" className="p-4 text-left font-bold">Total da conta no Resend</th><MetricCells metrics={report.totals} /></tr></tfoot></table></div>
        {search && <p className="px-5 py-3 text-xs text-gray-500">A busca filtra os tipos exibidos. O total e os cartões continuam representando toda a conta.</p>}
      </section>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400"><span>Falhas: {number(report.totals.failed)}</span><span>Suprimidos: {number(report.totals.suppressed)}</span><span>Entrega adiada: {number(report.totals.delivery_delayed)}</span><span>Descadastros: {number(report.totals.unsubscribed)}</span><span>Bounce / enviados: {percent(report.totals.bounced, report.totals.sent)}</span></div>
      <section className="mt-6 space-y-2 rounded-2xl border border-gray-800 p-5 text-xs leading-relaxed text-gray-400">
        <p><strong className="text-gray-200">Como interpretar:</strong> os números contam os eventos que ocorreram no período. Uma abertura hoje pode ser de um email enviado antes.</p>
        <p><strong className="text-gray-200">Aberto e clique:</strong> cada email conta uma vez nas colunas principais. A linha menor inclui repetições. Proteções de privacidade e robôs podem gerar aberturas e cliques automáticos.</p>
        <p><strong className="text-gray-200">Leitura:</strong> não disponibilizada pela API. Abertura não confirma que a pessoa leu a mensagem. Spam significa denúncia registrada, não detecção da pasta de spam.</p>
        <p><strong className="text-gray-200">Tipos:</strong> identificados pelo ID do envio nos registros do DCC. Emails sem correspondência ficam em Outros, sem perder suas métricas. {number(report.meta.classifiedCount)} de {number(report.meta.emailCount)} emails com tipo identificado.</p>
        <p>Histórico e rastreamento dependem da retenção do plano e das configurações do domínio no Resend. Fonte: {report.meta.source}.</p>
        <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-fuchsia-300">Abrir Resend<FiExternalLink /></a>
      </section>
    </>}
  </main>
}
