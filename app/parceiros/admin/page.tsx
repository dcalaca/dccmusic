'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FiBarChart2,
  FiCalendar,
  FiCopy,
  FiDownload,
  FiLogOut,
  FiMail,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi'

type PartnerDashboard = {
  isPartner: boolean
  setupRequired?: boolean
  partner?: {
    displayName: string
    email: string
    partnerCode: string
    commissionPercentage: number
    commissionModel: 'percentage' | 'cpa'
    commissionPaymentScope: 'lifetime' | 'first_purchase'
    cpaStudioTopupAmount: number
    cpaSubscriptionAmount: number
    commissionCapAmount?: number | null
    attributionWindowDays: number
    customerLifetimeMonths: number
    requiresPasswordChange: boolean
    isActive: boolean
  }
  metrics?: {
    clicks: number
    validSessions: number
    humans: number
    signups: number
    purchases: number
    revenue: number
    commission: number
    averageTicket: number
    signupConversion: number
    purchaseConversion: number
  }
  period?: {
    startDate: string
    endDate: string
  }
  daily?: Array<{
    date: string
    signups: number
    salesQuantity: number
    salesValue: number
  }>
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function number(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value || 0)
}

function partnerCommissionDescription(partner?: PartnerDashboard['partner']) {
  if (!partner) return ''
  if (partner.commissionModel === 'cpa') {
    const cap = partner.commissionCapAmount ? ` · teto ${money(partner.commissionCapAmount)}` : ''
    const scope = partner.commissionPaymentScope === 'first_purchase' ? ' · só primeira compra' : ''
    return `CPA: ${money(partner.cpaStudioTopupAmount)} por música avulsa · ${money(partner.cpaSubscriptionAmount)} por assinatura${cap}${scope}`
  }
  return `comissão: ${partner.commissionPercentage}%`
}

function inputDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function getDefaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return { startDate: inputDate(start), endDate: inputDate(end) }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T00:00:00`))
}

function MetricCard({
  label,
  value,
  onExport,
}: {
  label: string
  value: string
  onExport?: () => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/70 bg-cyan-950/40 px-2 py-1 text-[11px] font-bold text-cyan-100 hover:border-cyan-300"
          >
            <FiDownload />
            XLSX
          </button>
        )}
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-300">{label}</span>
        <span className="font-bold text-white">{number(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-400" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function SimpleBarChart({
  title,
  rows,
  field,
  valueFormatter,
}: {
  title: string
  rows: NonNullable<PartnerDashboard['daily']>
  field: 'signups' | 'salesQuantity' | 'salesValue'
  valueFormatter: (value: number) => string
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[field]) || 0))

  return (
    <div className={title ? 'rounded-2xl border border-white/10 bg-white/[0.045] p-4' : ''}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          <FiBarChart2 className="text-primary-300" />
          <h3 className="font-black text-white">{title}</h3>
        </div>
      )}
      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-2">
        {rows.map((row) => {
          const value = Number(row[field]) || 0
          const height = Math.max(4, Math.round((value / max) * 150))

          return (
            <div key={`${title}-${row.date}`} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-2">
              <div className="text-[11px] font-bold text-gray-300">{valueFormatter(value)}</div>
              <div
                className="w-full max-w-10 rounded-t-xl bg-gradient-to-t from-primary-700 to-cyan-300"
                style={{ height }}
                title={`${shortDate(row.date)}: ${valueFormatter(value)}`}
              />
              <div className="-rotate-45 text-[10px] text-gray-500">{shortDate(row.date)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PartnerDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<PartnerDashboard | null>(null)
  const [range, setRange] = useState(getDefaultRange)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [salesMetric, setSalesMetric] = useState<'quantity' | 'value'>('quantity')

  const loadDashboard = async () => {
    const token = localStorage.getItem('partner_token')
    if (!token) {
      router.push('/parceiros/login')
      return
    }

    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      })
      const response = await fetch(`/api/partners/me?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao carregar gerencial')

      if (result?.partner?.requiresPasswordChange) {
        router.push('/parceiros/trocar-senha')
        return
      }

      setData(result)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar gerencial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [range.startDate, range.endDate])

  const partnerLink = data?.partner
    ? `${typeof window !== 'undefined' && window.location.origin.includes('vercel.app') ? 'https://www.dccmusic.online' : typeof window !== 'undefined' ? window.location.origin : 'https://www.dccmusic.online'}/r/${data.partner.partnerCode}`
    : ''

  const copyLink = async () => {
    if (!partnerLink) return
    await navigator.clipboard.writeText(partnerLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const logout = () => {
    localStorage.removeItem('partner_token')
    localStorage.removeItem('partner_data')
    router.push('/parceiros/login')
  }

  const setQuickRange = (type: 'today' | 'yesterday' | '7' | '30' | 'currentMonth' | 'previousMonth') => {
    const today = new Date()
    let start = new Date()
    let end = new Date()

    if (type === 'yesterday') {
      start.setDate(today.getDate() - 1)
      end.setDate(today.getDate() - 1)
    }

    if (type === '7') {
      start.setDate(today.getDate() - 6)
    }

    if (type === '30') {
      start.setDate(today.getDate() - 29)
    }

    if (type === 'currentMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
    }

    if (type === 'previousMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
    }

    setRange({ startDate: inputDate(start), endDate: inputDate(end) })
  }

  const downloadExport = async (type: 'signups' | 'purchases') => {
    const token = localStorage.getItem('partner_token')
    if (!token) {
      router.push('/parceiros/login')
      return
    }

    try {
      setExporting(type)
      setError('')
      const params = new URLSearchParams({
        type,
        startDate: range.startDate,
        endDate: range.endDate,
      })
      const response = await fetch(`/api/partners/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Erro ao exportar XLSX')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dccmusic-${type === 'signups' ? 'cadastros' : 'compras'}-${range.startDate}-a-${range.endDate}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar XLSX')
    } finally {
      setExporting('')
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 text-gray-400">Carregando gerencial...</div>
      </div>
    )
  }

  if (data?.setupRequired) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-6 text-yellow-100">
            O sistema de parceiros ainda precisa do SQL no Supabase.
          </div>
        </div>
      </div>
    )
  }

  const metrics = data?.metrics
  const daily = data?.daily || []
  const funnelMax = Math.max(metrics?.clicks || 0, metrics?.validSessions || 0, metrics?.signups || 0, metrics?.purchases || 0)

  return (
    <div className="min-h-screen py-5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-950/40 px-3 py-1 text-xs font-bold text-cyan-200">
                <FiTrendingUp /> Área do parceiro
              </p>
              <p className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-semibold text-gray-300">
                <FiMail /> {data?.partner?.email}
              </p>
            </div>
            <h1 className="text-3xl font-black leading-tight">
              <span className="gradient-text">{data?.partner?.displayName}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Janela de atribuição: {data?.partner?.attributionWindowDays} dias · LT: {data?.partner?.customerLifetimeMonths} meses · {partnerCommissionDescription(data?.partner)}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              {[
                ['today', 'Hoje'],
                ['yesterday', 'Ontem'],
                ['7', 'Últimos 7 dias'],
                ['30', 'Últimos 30 dias'],
                ['currentMonth', 'Mês atual'],
                ['previousMonth', 'Mês anterior'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuickRange(value as any)}
                  className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs font-bold text-gray-300 hover:border-primary-500 hover:text-white"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300">
                <FiCalendar className="text-gray-500" />
                <span className="shrink-0">De</span>
                <input
                  type="date"
                  value={range.startDate}
                  onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
                  className="min-w-0 flex-1 bg-transparent text-white outline-none lg:w-36"
                />
              </label>
              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300">
                <span className="shrink-0">Até</span>
                <input
                  type="date"
                  value={range.endDate}
                  onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
                  className="min-w-0 flex-1 bg-transparent text-white outline-none lg:w-36"
                />
              </label>
              <button
                type="button"
                onClick={loadDashboard}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-primary-500 sm:col-span-1"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-800 px-4 py-2 text-sm font-bold text-red-200 hover:border-red-500 sm:col-span-1"
              >
                <FiLogOut />
                Sair
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">{error}</div>}

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Seu link de parceiro</p>
          <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-black/30 px-3 py-2">
            <input readOnly value={partnerLink} className="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none" />
            <button type="button" onClick={copyLink} className="text-cyan-200 hover:text-cyan-100">
              <FiCopy />
            </button>
          </div>
          {copied && <p className="mt-2 text-xs text-green-300">Link copiado.</p>}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Cliques brutos" value={number(metrics?.clicks || 0)} />
          <MetricCard label="Sessões válidas" value={number(metrics?.validSessions || 0)} />
          <MetricCard label="Humanos detectados" value={number(metrics?.humans || 0)} />
          <MetricCard
            label="Cadastros"
            value={number(metrics?.signups || 0)}
            onExport={exporting === 'signups' ? undefined : () => downloadExport('signups')}
          />
          <MetricCard
            label="Compras"
            value={number(metrics?.purchases || 0)}
            onExport={exporting === 'purchases' ? undefined : () => downloadExport('purchases')}
          />
          <MetricCard label="Receita gerada" value={money(metrics?.revenue || 0)} />
          <MetricCard label="Ticket médio" value={money(metrics?.averageTicket || 0)} />
          <MetricCard label="Conversão compra" value={`${metrics?.purchaseConversion || 0}%`} />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-5">
          <h2 className="mb-4 text-lg font-black">Funil</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <FunnelBar label="Cliques" value={metrics?.clicks || 0} max={funnelMax} />
            <FunnelBar label="Sessões reais" value={metrics?.validSessions || 0} max={funnelMax} />
            <FunnelBar label="Cadastros" value={metrics?.signups || 0} max={funnelMax} />
            <FunnelBar label="Compras" value={metrics?.purchases || 0} max={funnelMax} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <SimpleBarChart
            title="Cadastros diários"
            rows={daily}
            field="signups"
            valueFormatter={(value) => number(value)}
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FiBarChart2 className="text-primary-300" />
                <h3 className="font-black text-white">Vendas diárias</h3>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSalesMetric('quantity')}
                  className={`rounded-lg px-3 py-1.5 ${salesMetric === 'quantity' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
                >
                  Quantidade
                </button>
                <button
                  type="button"
                  onClick={() => setSalesMetric('value')}
                  className={`rounded-lg px-3 py-1.5 ${salesMetric === 'value' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
                >
                  Valor (R$)
                </button>
              </div>
            </div>
            <SimpleBarChart
              title=""
              rows={daily}
              field={salesMetric === 'quantity' ? 'salesQuantity' : 'salesValue'}
              valueFormatter={(value) => salesMetric === 'quantity' ? number(value) : money(value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

