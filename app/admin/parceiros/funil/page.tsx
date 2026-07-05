'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiBarChart2, FiFilter, FiRefreshCw, FiSearch, FiShoppingCart, FiUserPlus, FiUsers } from 'react-icons/fi'

type FunnelPartner = {
  partnerId: string
  displayName: string
  email?: string | null
  partnerCode: string
  isActive: boolean
  clicks: number
  signups: number
  sales: number
  topupSales: number
  subscriptionSales: number
  otherSales: number
  revenue: number
  commission: number
  topupRevenue: number
  subscriptionRevenue: number
  otherRevenue: number
  topupCommission: number
  subscriptionCommission: number
  otherCommission: number
  signupRate: number
  salesRate: number
}

type FunnelResponse = {
  period: { range: string; startDate: string; endDate: string }
  partners: FunnelPartner[]
  totals: {
    clicks: number
    signups: number
    sales: number
    topupSales: number
    subscriptionSales: number
    otherSales: number
    revenue: number
    commission: number
    topupRevenue: number
    subscriptionRevenue: number
    otherRevenue: number
    topupCommission: number
    subscriptionCommission: number
    otherCommission: number
  }
  setupRequired?: boolean
}

type PartnerOption = {
  id: string
  label: string
}

const quickRanges = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last7', label: '7 dias' },
  { id: 'last30', label: '30 dias' },
  { id: 'currentMonth', label: 'Mês atual' },
  { id: 'previousMonth', label: 'Mês anterior' },
]

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return { startDate: inputDate(start), endDate: inputDate(end) }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0)
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-gray-400">{label}</span>
        <span className="rounded-xl bg-primary-600/20 p-2 text-primary-200"><Icon /></span>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

export default function AdminPartnersFunnelPage() {
  const initialRange = useMemo(() => defaultRange(), [])
  const [data, setData] = useState<FunnelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [range, setRange] = useState('last7')
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [partnerId, setPartnerId] = useState('')
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([])
  const [search, setSearch] = useState('')

  const loadPartnerOptions = async () => {
    try {
      const response = await fetch('/api/admin/partners', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) return
      setPartnerOptions((result.partners || []).map((partner: any) => ({
        id: partner.id,
        label: `${partner.displayName} (${partner.partnerCode})`,
      })).sort((a: PartnerOption, b: PartnerOption) => a.label.localeCompare(b.label)))
    } catch {
      setPartnerOptions([])
    }
  }

  const loadFunnel = async (override?: { range?: string; startDate?: string; endDate?: string; partnerId?: string }) => {
    try {
      setLoading(true)
      setError('')
      const selectedRange = override?.range ?? range
      const selectedPartnerId = override?.partnerId ?? partnerId
      const params = new URLSearchParams()
      params.set('range', selectedRange)
      if (selectedRange === 'custom') {
        params.set('startDate', override?.startDate ?? startDate)
        params.set('endDate', override?.endDate ?? endDate)
      }
      if (selectedPartnerId) params.set('partnerId', selectedPartnerId)

      const response = await fetch(`/api/admin/partners/funnel?${params.toString()}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao carregar funil')
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar funil')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPartnerOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allPartners = data?.partners || []
  const filteredPartners = allPartners.filter((partner) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return [partner.displayName, partner.email || '', partner.partnerCode]
      .some((value) => value.toLowerCase().includes(needle))
  })
  const totals = data?.totals || {
    clicks: 0,
    signups: 0,
    sales: 0,
    topupSales: 0,
    subscriptionSales: 0,
    otherSales: 0,
    revenue: 0,
    commission: 0,
    topupRevenue: 0,
    subscriptionRevenue: 0,
    otherRevenue: 0,
    topupCommission: 0,
    subscriptionCommission: 0,
    otherCommission: 0,
  }
  const signupRate = totals.clicks > 0 ? Math.round((totals.signups / totals.clicks) * 10000) / 100 : 0
  const salesRate = totals.signups > 0 ? Math.round((totals.sales / totals.signups) * 10000) / 100 : 0

  const applyQuickRange = (nextRange: string) => {
    setRange(nextRange)
    setData(null)
    setError('')
  }

  const applyCustomRange = () => {
    setRange('custom')
    setData(null)
    setError('')
  }

  const applyPartnerFilter = (nextPartnerId: string) => {
    setPartnerId(nextPartnerId)
    setData(null)
    setError('')
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin/parceiros" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
              <FiArrowLeft /> Voltar para parceiros
            </Link>
            <h1 className="text-4xl font-black"><span className="gradient-text">Funil por parceiro</span></h1>
            <p className="mt-2 text-gray-400">Acompanhe clicks, cadastros confirmados e vendas atribuídas por período.</p>
          </div>
          <button
            type="button"
            onClick={() => loadFunnel()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-sm font-bold text-gray-200 hover:border-primary-500"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">{error}</div>}
        {data?.setupRequired && (
          <div className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-950/30 p-5 text-yellow-100">
            Rode o SQL do sistema de parceiros antes de consultar o funil.
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-gray-800 bg-gray-900/60 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-gray-400">
            <FiFilter /> Filtros
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="flex flex-wrap gap-2">
              {quickRanges.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyQuickRange(item.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    range === item.id
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                      : 'border border-gray-800 bg-black/30 text-gray-300 hover:border-primary-500'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <select
              value={partnerId}
              onChange={(event) => applyPartnerFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
            >
              <option value="">Todos os parceiros</option>
              {partnerOptions.map((partner) => <option key={partner.id} value={partner.id}>{partner.label}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_auto]">
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                setRange('custom')
                setData(null)
                setError('')
              }}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                setRange('custom')
                setData(null)
                setError('')
              }}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
            />
            <button type="button" onClick={applyCustomRange} className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold text-white hover:bg-gray-700">
              Aplicar personalizado
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900/60 p-10 text-center text-gray-400">
            Carregando funil...
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900/60 p-10 text-center text-gray-400">
            Escolha o período/parceiro e clique em Atualizar para consultar o funil.
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={FiUsers} label="Clicks" value={formatNumber(totals.clicks)} detail="Sessões únicas atribuídas" />
              <MetricCard icon={FiUserPlus} label="Cadastros" value={formatNumber(totals.signups)} detail={`${signupRate}% dos clicks`} />
              <MetricCard icon={FiShoppingCart} label="Vendas" value={formatNumber(totals.sales)} detail={`${salesRate}% dos cadastros`} />
              <MetricCard icon={FiBarChart2} label="Faturamento" value={formatMoney(totals.revenue)} detail="Valor vendido atribuído" />
              <MetricCard icon={FiBarChart2} label="Comissões" value={formatMoney(totals.commission)} detail="Comissão estimada" />
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                icon={FiShoppingCart}
                label="Avulsas / recargas"
                value={formatNumber(totals.topupSales)}
                detail={`Receita ${formatMoney(totals.topupRevenue)} · Comissão ${formatMoney(totals.topupCommission)}`}
              />
              <MetricCard
                icon={FiShoppingCart}
                label="Assinaturas / planos"
                value={formatNumber(totals.subscriptionSales)}
                detail={`Receita ${formatMoney(totals.subscriptionRevenue)} · Comissão ${formatMoney(totals.subscriptionCommission)}`}
              />
              {totals.otherSales > 0 && (
                <MetricCard
                  icon={FiShoppingCart}
                  label="Outras compras"
                  value={formatNumber(totals.otherSales)}
                  detail={`Receita ${formatMoney(totals.otherRevenue)} · Comissão ${formatMoney(totals.otherCommission)}`}
                />
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-gray-900/60 p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Tabela do funil</h2>
              <p className="text-sm text-gray-400">Ordenado por maior volume de clicks.</p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar parceiro..."
                className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-3 pr-4">Parceiro</th>
                  <th className="py-3 px-4 text-right">Clicks</th>
                  <th className="py-3 px-4 text-right">Cadastros</th>
                  <th className="py-3 px-4 text-right">Vendas</th>
                  <th className="py-3 px-4 text-right">Avulsas</th>
                  <th className="py-3 px-4 text-right">Planos</th>
                  <th className="py-3 px-4 text-right">Conv. cadastro</th>
                  <th className="py-3 px-4 text-right">Conv. venda</th>
                  <th className="py-3 px-4 text-right">Faturamento</th>
                  <th className="py-3 pl-4 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr><td colSpan={10} className="py-8 text-center text-gray-400">Carregando funil...</td></tr>
                ) : filteredPartners.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-gray-400">Nenhum dado encontrado no período.</td></tr>
                ) : filteredPartners.map((partner) => (
                  <tr key={partner.partnerId} className="hover:bg-white/[0.03]">
                    <td className="py-4 pr-4">
                      <p className="font-black text-white">{partner.displayName}</p>
                      <p className="text-xs text-gray-500">{partner.email || 'Sem e-mail'} · {partner.partnerCode}</p>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-cyan-200">{formatNumber(partner.clicks)}</td>
                    <td className="py-4 px-4 text-right font-bold text-purple-200">{formatNumber(partner.signups)}</td>
                    <td className="py-4 px-4 text-right font-bold text-green-200">{formatNumber(partner.sales)}</td>
                    <td className="py-4 px-4 text-right text-gray-200">
                      <p className="font-bold">{formatNumber(partner.topupSales)}</p>
                      <p className="text-[11px] text-gray-500">{formatMoney(partner.topupCommission)}</p>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-200">
                      <p className="font-bold">{formatNumber(partner.subscriptionSales)}</p>
                      <p className="text-[11px] text-gray-500">{formatMoney(partner.subscriptionCommission)}</p>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-300">{partner.signupRate}%</td>
                    <td className="py-4 px-4 text-right text-gray-300">{partner.salesRate}%</td>
                    <td className="py-4 px-4 text-right text-gray-200">{formatMoney(partner.revenue)}</td>
                    <td className="py-4 pl-4 text-right text-yellow-200">{formatMoney(partner.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
