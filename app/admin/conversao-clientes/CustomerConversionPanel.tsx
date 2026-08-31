'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiRefreshCw, FiTrendingUp, FiUsers } from 'react-icons/fi'

type Preset = 'yesterday' | 'today' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'
type Summary = {
  period: { startDate: string; endDate: string }
  country: string | null
  cohort: { total: number; withMusic: number; withoutMusic: number; buyers: number; nonBuyers: number }
  conversion: {
    musicActivationRate: number
    purchaseRate: number
    withMusicPurchaseRate: number
    withoutMusicPurchaseRate: number
    buyersWithMusicRate: number
    repeatPurchaseRate: number
    repeatBuyers: number
  }
  groups: {
    withMusic: { total: number; buyers: number; nonBuyers: number; revenue: number }
    withoutMusic: { total: number; buyers: number; nonBuyers: number; revenue: number }
  }
  revenue: { total: number; purchases: number; averagePerBuyer: number; averageTicket: number }
  acquisition: { adSpend: number; configured: boolean; warning: string | null; costPerRegistration: number; costPerBuyer: number; spendPerNonBuyer: number; roas: number; revenueAfterAds: number }
}

const presetLabels: Record<Preset, string> = {
  yesterday: 'Ontem', today: 'Hoje', last30: 'Últimos 30 dias', thisMonth: 'Este mês', lastMonth: 'Mês passado', custom: 'Personalizado',
}
const countries = [
  { code: '', label: 'Todos os países' }, { code: 'BR', label: '🇧🇷 Brasil' },
  { code: 'PY', label: '🇵🇾 Paraguai' }, { code: 'CO', label: '🇨🇴 Colômbia' },
  { code: 'MX', label: '🇲🇽 México' }, { code: 'PT', label: '🇵🇹 Portugal' },
]

function dateToInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next }
function getRange(preset: Preset) {
  const now = new Date()
  if (preset === 'yesterday') { const d = addDays(now, -1); return { startDate: dateToInput(d), endDate: dateToInput(d) } }
  if (preset === 'today') return { startDate: dateToInput(now), endDate: dateToInput(now) }
  if (preset === 'last30') return { startDate: dateToInput(addDays(now, -29)), endDate: dateToInput(now) }
  if (preset === 'lastMonth') return { startDate: dateToInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)), endDate: dateToInput(new Date(now.getFullYear(), now.getMonth(), 0)) }
  return { startDate: dateToInput(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: dateToInput(now) }
}
function number(value: number) { return value.toLocaleString('pt-BR') }
function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function percent(value: number) { return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }

function Kpi({ label, value, hint, tone = 'cyan' }: { label: string; value: string; hint: string; tone?: 'cyan' | 'green' | 'purple' | 'yellow' }) {
  const tones = { cyan: 'text-cyan-300', green: 'text-green-300', purple: 'text-purple-300', yellow: 'text-yellow-300' }
  return <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4"><p className="text-xs text-gray-500">{label}</p><p className={`mt-2 text-2xl font-black ${tones[tone]}`}>{value}</p><p className="mt-1 text-xs text-gray-500">{hint}</p></div>
}

function SplitBar({ leftLabel, leftValue, rightLabel, rightValue, total }: { leftLabel: string; leftValue: number; rightLabel: string; rightValue: number; total: number }) {
  const left = total > 0 ? (leftValue / total) * 100 : 0
  return <div><div className="mb-2 flex justify-between gap-4 text-sm"><span className="text-green-300">{leftLabel}: <strong>{number(leftValue)}</strong></span><span className="text-gray-400">{rightLabel}: <strong>{number(rightValue)}</strong></span></div><div className="flex h-4 overflow-hidden rounded-full bg-gray-800"><div className="bg-green-500" style={{ width: `${left}%` }} /><div className="bg-gray-600" style={{ width: `${100 - left}%` }} /></div></div>
}

export default function CustomerConversionPanel() {
  const [preset, setPreset] = useState<Preset>('thisMonth')
  const [range, setRange] = useState(() => getRange('thisMonth'))
  const [country, setCountry] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const query = useMemo(() => { const p = new URLSearchParams(range); if (country) p.set('country', country); return p.toString() }, [range, country])

  const load = async () => {
    try { setLoading(true); setError(''); const response = await fetch(`/api/admin/customer-conversion?${query}`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Erro ao calcular conversão'); setSummary(data) }
    catch (err: any) { setError(err.message || 'Erro ao calcular conversão'); setSummary(null) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [query])

  const selectPreset = (next: Preset) => { setPreset(next); if (next !== 'custom') setRange(getRange(next)) }
  const updateDate = (key: 'startDate' | 'endDate', value: string) => { setPreset('custom'); setRange(prev => ({ ...prev, [key]: value })) }

  return <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-bold text-cyan-300">Inteligência financeira</p><h1 className="mt-2 text-3xl font-black text-white">Conversão de clientes</h1><p className="mt-2 text-sm text-gray-400">Acompanhe se os novos cadastros criam músicas, viram compradores e quanto geram de receita ao longo da vida.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-60"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Atualizar</button></div>
    <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(presetLabels) as Preset[]).map(item => <button key={item} onClick={() => selectPreset(item)} className={`text-sm underline-offset-4 ${preset === item ? 'text-cyan-300 underline' : 'text-gray-400 hover:text-cyan-300 hover:underline'}`}>{presetLabels[item]}</button>)}</div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><label><span className="mb-1 flex items-center gap-1 text-xs text-gray-500"><FiCalendar /> Data inicial</span><input type="date" value={range.startDate} onChange={e => updateDate('startDate', e.target.value)} className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white" /></label><label><span className="mb-1 flex items-center gap-1 text-xs text-gray-500"><FiCalendar /> Data final</span><input type="date" value={range.endDate} onChange={e => updateDate('endDate', e.target.value)} className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white" /></label><label><span className="mb-1 block text-xs text-gray-500">País</span><select value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white">{countries.map(item => <option key={item.code || 'all'} value={item.code}>{item.label}</option>)}</select></label></div>
    {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
    {loading && !summary ? <div className="rounded-xl border border-gray-800 p-6 text-gray-400">Calculando indicadores...</div> : summary ? <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Cadastros" value={number(summary.cohort.total)} hint="Usuários cadastrados no período" /><Kpi label="Criaram música" value={percent(summary.conversion.musicActivationRate)} hint={`${number(summary.cohort.withMusic)} usuários ativados`} tone="green" /><Kpi label="Viraram compradores" value={percent(summary.conversion.purchaseRate)} hint={`${number(summary.cohort.buyers)} compradores`} tone="purple" /><Kpi label="Receita da safra" value={money(summary.revenue.total)} hint="Valor gasto por esses usuários" tone="yellow" /></div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5"><div className="mb-5 flex items-center gap-2"><FiUsers className="text-green-300" /><div><h2 className="font-bold text-white">Usuários que entram e criam música</h2><p className="text-xs text-gray-500">Ativação dos cadastrados selecionados.</p></div></div><SplitBar leftLabel="Com música" leftValue={summary.cohort.withMusic} rightLabel="Sem música" rightValue={summary.cohort.withoutMusic} total={summary.cohort.total} /><p className="mt-4 text-3xl font-black text-green-300">{percent(summary.conversion.musicActivationRate)}</p></div>
      <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5"><div className="mb-5 flex items-center gap-2"><FiTrendingUp className="text-purple-300" /><div><h2 className="font-bold text-white">Quem cria música e compra</h2><p className="text-xs text-gray-500">Conversão dentro do grupo que experimentou o produto.</p></div></div><SplitBar leftLabel="Com compra" leftValue={summary.groups.withMusic.buyers} rightLabel="Sem compra" rightValue={summary.groups.withMusic.nonBuyers} total={summary.groups.withMusic.total} /><p className="mt-4 text-3xl font-black text-purple-300">{percent(summary.conversion.withMusicPurchaseRate)}</p></div></div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5"><h2 className="font-bold text-white">Perfil de quem compra</h2><p className="mb-5 mt-1 text-xs text-gray-500">Quantos compradores também chegaram a criar música.</p><SplitBar leftLabel="Compradores com música" leftValue={summary.groups.withMusic.buyers} rightLabel="Compradores sem música" rightValue={summary.groups.withoutMusic.buyers} total={summary.cohort.buyers} /><p className="mt-4 text-sm text-gray-400">{percent(summary.conversion.buyersWithMusicRate)} dos compradores criaram ao menos uma música.</p></div><div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5"><h2 className="font-bold text-white">Valor dos compradores</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Kpi label="Média por comprador" value={money(summary.revenue.averagePerBuyer)} hint="Receita ÷ compradores" tone="green" /><Kpi label="Ticket médio" value={money(summary.revenue.averageTicket)} hint={`${number(summary.revenue.purchases)} compras realizadas`} tone="cyan" /></div></div></div>
      <div className="rounded-2xl border border-cyan-900/70 bg-gradient-to-br from-cyan-950/30 via-gray-950/70 to-black p-5"><div className="mb-4"><h2 className="text-xl font-black text-white">Aquisição e retorno</h2><p className="mt-1 text-xs text-gray-400">Cruza o investimento da Meta no período com o comportamento completo dos usuários cadastrados.</p>{summary.acquisition.warning && <p className="mt-2 text-xs text-yellow-300">{summary.acquisition.warning}</p>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Custo por cadastro" value={money(summary.acquisition.costPerRegistration)} hint={`${money(summary.acquisition.adSpend)} investidos`} tone="cyan" /><Kpi label="Custo por comprador" value={money(summary.acquisition.costPerBuyer)} hint="Anúncios ÷ compradores" tone="purple" /><Kpi label="Investimento por não comprador" value={money(summary.acquisition.spendPerNonBuyer)} hint="Anúncios ÷ usuários sem compra" tone="yellow" /><Kpi label="ROAS da safra" value={`${summary.acquisition.roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`} hint={`${money(summary.acquisition.revenueAfterAds)} após anúncios`} tone="green" /></div></div>
      <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5"><h2 className="font-bold text-white">Recorrência dos compradores</h2><p className="mt-1 text-xs text-gray-500">Compradores dessa safra que já fizeram duas ou mais compras.</p><div className="mt-4 flex items-end gap-3"><span className="text-3xl font-black text-primary-300">{percent(summary.conversion.repeatPurchaseRate)}</span><span className="pb-1 text-sm text-gray-400">{number(summary.conversion.repeatBuyers)} compradores recorrentes</span></div></div>
    </div> : null}
  </section>
}
