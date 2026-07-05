'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiCpu, FiDollarSign, FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi'

type Preset = 'yesterday' | 'today' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'

type FinanceSummary = {
  period: {
    startDate: string
    endDate: string
  }
  revenue: {
    subscriptions: number
    featured: number
    studioTopups: number
    videos: number
    total: number
  }
  costs: {
    music: number
    lyricVideos: number
    simpleCovers: number
    premiumCovers: number
    lyrics: number
    metaAds: number
    mercadoPagoFees: number
    resendEmails: number
    vercelHosting: number
    supabaseHosting: number
    sunoPaidMusic: number
    sunoFreeMusic: number
    sunoLyricVideos: number
    suno: number
    openAi: number
    fixed: {
      supabase: number
      vercel: number
      resend: number
      total: number
    }
    variable: {
      metaAds: number
      mercadoPagoFees: number
      suno: number
      openAi: number
      total: number
    }
    total: number
  }
  profit: {
    estimated: number
    margin: number
  }
  counts: {
    subscriptionPayments: number
    featuredPayments: number
    studioTopupPayments: number
    paidVideoRequests: number
    musicGenerations: number
    paidMusicGenerations: number
    freeMusicGenerations: number
    untrackedMusicGenerations: number
    lyricVideos: number
    simpleCovers: number
    premiumCovers: number
    lyricGenerations: number
    metaAdCampaigns: number
    metaAdClicks: number
    metaAdImpressions: number
    metaAdRegistrations: number
    realRegistrationsInPeriod: number
    sentEmails: number
  }
  sales: {
    averageTicket: number
    totalQuantity: number
    series: Array<{
      date: string
      amount: number
      count: number
    }>
  }
  paymentDetails: Array<{
    id: string
    source: 'subscription' | 'featured' | 'studio_topup' | 'video'
    label: string
    amount: number
    paidAt: string | null
    customerName: string
    customerEmail: string
    description: string
    paymentMethod: string | null
    mercadoPagoFee: number
  }>
  costAssumptions: {
    sunoCreditCostBrl: number
    sunoMusicGenerationCredits: number
    sunoLyricVideoCredits: number
    sunoMaxCreditsPerCompleteMusic: number
    musicGeneration: number
    lyricVideo: number
    simpleCover: number
    premiumCover: number
    lyricGeneration: number
    resendMonthlyFixed: number
    resendPerEmail: number
    vercelMonthlyFixed: number
    supabaseMonthlyFixed: number
    mercadoPagoPixRate: number
    mercadoPagoCardRate: number
    openAiUsdToBrl: number
    usdToBrl: number
  }
  externalBalances?: {
    suno?: {
      configured: boolean
      availableCredits: number | null
      error: string | null
      checkedAt: string
    }
    openai?: {
      configured: boolean
      costUsd: number | null
      monthCostUsd: number | null
      monthlyBudgetUsd: number | null
      alertThresholdPercent: number
      currency: string
      error: string | null
      checkedAt: string
    }
    metaAds?: {
      configured: boolean
      currency: string
      spend: number
      clicks: number
      impressions: number
      registrations: number
      adAccounts: string[]
      ignoredSpend: number
      ignoredCount: number
      filterDescription: string
      campaigns: Array<{
        adAccountId: string
        adId: string
        adName: string
        campaignId: string
        campaignName: string
        spend: number
        clicks: number
        impressions: number
        cpc: number | null
        registrations: number
      }>
      error: string | null
      checkedAt: string
    }
    metaAdsBalance?: {
      configured: boolean
      currency: string
      balanceDue: number | null
      amountSpent: number | null
      spendCap: number | null
      availableBalance: number | null
      adAccounts: Array<{
        adAccountId: string
        currency: string
        balanceDue: number | null
        amountSpent: number | null
        spendCap: number | null
        availableBalance: number | null
      }>
      error: string | null
      checkedAt: string
    }
    mercadoPago?: {
      configured: boolean
      estimatedCost: number
      pixAmount: number
      pixFees: number
      pixCount: number
      cardAmount: number
      cardFees: number
      cardCount: number
      totalAmount: number
      totalFees: number
      pixRate: number
      cardRate: number
      effectiveRate: number
      checkedAt: string
    }
    resend?: {
      configured: boolean
      sentEmails: number
      transactionalEmails?: number
      campaignEmails?: number
      variableCost: number
      fixedCost: number
      estimatedCost: number
      categories: Array<{
        category: string
        count: number
      }>
      error: string | null
      checkedAt: string
    }
    vercel?: {
      configured: boolean
      monthlyFixedCost: number
      fixedCost: number
      estimatedCost: number
      periodDayCount: number
      checkedAt: string
    }
    supabase?: {
      configured: boolean
      monthlyFixedCost: number
      fixedCost: number
      estimatedCost: number
      periodDayCount: number
      checkedAt: string
    }
  }
}

const presetLabels: Record<Preset, string> = {
  yesterday: 'Ontem',
  today: 'Hoje',
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

  if (preset === 'yesterday') {
    const yesterday = addDays(now, -1)
    return { startDate: dateToInput(yesterday), endDate: dateToInput(yesterday) }
  }

  if (preset === 'today') {
    return { startDate: dateToInput(now), endDate: dateToInput(now) }
  }

  if (preset === 'last30') {
    return { startDate: dateToInput(addDays(now, -29)), endDate: dateToInput(now) }
  }

  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { startDate: dateToInput(start), endDate: dateToInput(end) }
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: dateToInput(start), endDate: dateToInput(now) }
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatAdMoney(value: number, currency = 'BRL') {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency,
  })
}

function formatOptionalAdMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null) return '-'
  return formatAdMoney(value, currency)
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatUsd(value: number | null | undefined) {
  if (value == null) return '-'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatShortDate(value: string) {
  return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function FinanceSalesChart({ series }: { series: FinanceSummary['sales']['series'] }) {
  const width = 1400
  const height = 340
  const axisLeftX = 72
  const axisRightX = width - 72
  const paddingTop = 34
  const paddingBottom = 42
  const innerWidth = axisRightX - axisLeftX
  const innerHeight = height - paddingTop - paddingBottom
  const maxAmount = Math.max(1, ...series.map(day => day.amount))
  const maxCount = Math.max(1, ...series.map(day => day.count))
  const slotWidth = innerWidth / Math.max(1, series.length)
  const barWidth = Math.max(14, Math.min(34, slotWidth * 0.64))
  const linePath = series.map((day, index) => {
    const x = axisLeftX + (index * slotWidth) + slotWidth / 2
    const y = paddingTop + innerHeight - (day.count / maxCount) * innerHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  const labelEvery = Math.max(1, Math.ceil(series.length / 12))
  const yTicks = [1, 0.5, 0]

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-white">Valores e quantidades vendidas</h3>
          <p className="mt-1 text-xs text-gray-500">Barras mostram valor vendido; linha mostra quantidade de vendas.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Valor
          </span>
          <span className="inline-flex items-center gap-1 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-primary-400" />
            Quantidade
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-80 min-w-[1180px] w-full">
          <text x={axisLeftX} y="14" className="fill-green-300 text-[11px] font-semibold">Valor R$</text>
          <text x={axisRightX} y="14" textAnchor="end" className="fill-primary-300 text-[11px] font-semibold">Quantidade</text>

          {yTicks.map(tick => {
            const y = paddingTop + innerHeight - tick * innerHeight
            return (
              <g key={tick}>
                <line x1={axisLeftX} x2={axisRightX} y1={y} y2={y} stroke="#111827" strokeDasharray={tick === 0 ? undefined : '4 8'} />
                <text x={axisLeftX - 10} y={y + 4} textAnchor="end" className="fill-gray-600 text-[10px]">
                  {formatMoney(maxAmount * tick)}
                </text>
                <text x={axisRightX + 10} y={y + 4} className="fill-gray-600 text-[10px]">
                  {formatNumber(Math.round(maxCount * tick))}
                </text>
              </g>
            )
          })}

          <line x1={axisLeftX} x2={axisLeftX} y1={paddingTop} y2={paddingTop + innerHeight} stroke="#1f2937" />
          <line x1={axisRightX} x2={axisRightX} y1={paddingTop} y2={paddingTop + innerHeight} stroke="#1f2937" />

          {series.map((day, index) => {
            const centerX = axisLeftX + (index * slotWidth) + slotWidth / 2
            const x = centerX - barWidth / 2
            const amountHeight = day.amount > 0 ? Math.max(2, (day.amount / maxAmount) * innerHeight) : 0
            const backgroundY = paddingTop
            const backgroundHeight = innerHeight
            const barY = paddingTop + innerHeight - amountHeight
            const showLabel = index % labelEvery === 0 || index === series.length - 1
            const tooltip = `${formatShortDate(day.date)}\nValor: ${formatMoney(day.amount)}\nQuantidade: ${formatNumber(day.count)} venda(s)`

            return (
              <g key={day.date}>
                <title>{tooltip}</title>
                <rect
                  x={x}
                  y={backgroundY}
                  width={barWidth}
                  height={backgroundHeight}
                  rx="8"
                  className="fill-gray-900/90"
                  stroke="#1f2937"
                  strokeWidth="1"
                />
                {amountHeight > 0 && (
                  <rect
                    x={x}
                    y={barY}
                    width={barWidth}
                    height={amountHeight}
                    rx="7"
                    fill="#22c55e"
                    opacity="0.9"
                  />
                )}
                <rect
                  x={centerX - slotWidth / 2}
                  y={paddingTop}
                  width={slotWidth}
                  height={innerHeight}
                  fill="transparent"
                />
                {showLabel && (
                  <text x={centerX} y={height - 9} textAnchor="middle" className="fill-gray-700 text-[10px]">
                    {formatShortDate(day.date)}
                  </text>
                )}
              </g>
            )
          })}

          <path
            d={linePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.82"
          />
        </svg>
      </div>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return 'Data não informada'
  return new Date(value).toLocaleString('pt-BR')
}

export default function FinancePanel() {
  const [preset, setPreset] = useState<Preset>('thisMonth')
  const [range, setRange] = useState(() => getPresetRange('thisMonth'))
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedMetaGroups, setExpandedMetaGroups] = useState<Record<string, boolean>>({})
  const [paymentsPage, setPaymentsPage] = useState(1)

  const PAYMENTS_PER_PAGE = 10
  const totalPayments = summary?.paymentDetails.length || 0
  const totalPaymentPages = Math.max(1, Math.ceil(totalPayments / PAYMENTS_PER_PAGE))
  const currentPaymentsPage = Math.min(paymentsPage, totalPaymentPages)
  const paymentsStartIndex = (currentPaymentsPage - 1) * PAYMENTS_PER_PAGE
  const paginatedPayments = (summary?.paymentDetails || []).slice(
    paymentsStartIndex,
    paymentsStartIndex + PAYMENTS_PER_PAGE
  )

  useEffect(() => {
    setPaymentsPage(1)
  }, [summary])

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

      const response = await fetch(`/api/admin/finance?${queryString}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar painel financeiro')
      }

      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar painel financeiro')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const selectPreset = (nextPreset: Preset) => {
    setPreset(nextPreset)
    setSummary(null)
    setError('')
    if (nextPreset !== 'custom') {
      setRange(getPresetRange(nextPreset))
    }
  }

  const updateCustomDate = (field: 'startDate' | 'endDate', value: string) => {
    setPreset('custom')
    setSummary(null)
    setError('')
    setRange(prev => ({ ...prev, [field]: value }))
  }

  const metaAdGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string
      name: string
      spend: number
      clicks: number
      impressions: number
      registrations: number
      items: any[]
    }>()

    for (const ad of summary?.externalBalances?.metaAds?.campaigns || []) {
      const key = `${ad.adAccountId}-${ad.campaignId}`
      const existing = groups.get(key) || {
        key,
        name: ad.campaignName,
        spend: 0,
        clicks: 0,
        impressions: 0,
        registrations: 0,
        items: [],
      }

      existing.spend += ad.spend
      existing.clicks += ad.clicks
      existing.impressions += ad.impressions
      existing.registrations += ad.registrations
      existing.items.push(ad)
      groups.set(key, existing)
    }

    return Array.from(groups.values()).sort((a, b) => b.spend - a.spend)
  }, [summary])

  const toggleMetaGroup = (key: string) => {
    setExpandedMetaGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800 rounded-2xl p-5 sm:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary-300 mb-2">
            <FiDollarSign className="w-4 h-4" />
            Financeiro
          </div>
          <h2 className="text-2xl font-bold">Entrada, custo e lucro estimado</h2>
          <p className="text-gray-400 text-sm mt-1">
            Receita aprovada no período menos custos estimados de IA, Studio e anúncios.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-60"
          disabled={loading}
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(presetLabels) as Preset[]).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => selectPreset(item)}
            className={`text-sm underline-offset-4 transition-colors ${
              preset === item
                ? 'text-primary-300 underline'
                : 'text-gray-400 hover:text-primary-300 hover:underline'
            }`}
          >
            {presetLabels[item]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <label className="block">
          <span className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <FiCalendar className="w-3 h-3" />
            Data inicial
          </span>
          <input
            type="date"
            value={range.startDate}
            onChange={event => updateCustomDate('startDate', event.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
          />
        </label>

        <label className="block">
          <span className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <FiCalendar className="w-3 h-3" />
            Data final
          </span>
          <input
            type="date"
            value={range.endDate}
            onChange={event => updateCustomDate('endDate', event.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-200 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="border border-gray-800 rounded-xl p-6 text-gray-400 text-sm">
          Carregando painel financeiro...
        </div>
      ) : !summary ? (
        <div className="border border-gray-800 rounded-xl p-6 text-gray-400 text-sm">
          Escolha o período e clique em Atualizar para consultar o financeiro.
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <div className="min-w-0 bg-gray-950/70 border border-green-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Entrou</span>
                  <FiTrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-green-300 2xl:text-2xl">{formatMoney(summary.revenue.total)}</div>
                <p className="truncate text-xs text-gray-500 mt-1">Pagamentos aprovados</p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-orange-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Gasto total</span>
                  <FiTrendingDown className="w-5 h-5 text-orange-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-orange-300 2xl:text-2xl">{formatMoney(summary.costs.total)}</div>
                <p className="truncate text-xs text-gray-500 mt-1">
                  Fixo + variável
                </p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-primary-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Lucro estimado</span>
                  <FiDollarSign className="w-5 h-5 text-primary-400" />
                </div>
                <div className={`whitespace-nowrap text-xl font-bold 2xl:text-2xl ${summary.profit.estimated >= 0 ? 'text-primary-300' : 'text-red-300'}`}>
                  {formatMoney(summary.profit.estimated)}
                </div>
                <p className="truncate text-xs text-gray-500 mt-1" title={`Receita - gasto total • Margem: ${formatPercent(summary.profit.margin)}`}>
                  Receita - gasto total • Margem: {formatPercent(summary.profit.margin)}
                </p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-cyan-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Ticket médio</span>
                  <FiDollarSign className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-cyan-300 2xl:text-2xl">{formatMoney(summary.sales.averageTicket || 0)}</div>
                <p className="truncate text-xs text-gray-500 mt-1">
                  {formatNumber(summary.sales.totalQuantity || 0)} venda(s) no período
                </p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-purple-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Saldo IA musical</span>
                  <FiCpu className="w-5 h-5 text-purple-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-purple-300 2xl:text-2xl">
                  {summary.externalBalances?.suno?.availableCredits ?? '-'}
                </div>
                <p className="truncate text-xs text-gray-500 mt-1" title={summary.externalBalances?.suno?.error || 'Créditos disponíveis na API'}>
                  {summary.externalBalances?.suno?.error
                    ? summary.externalBalances.suno.error
                    : 'Créditos disponíveis na API'}
                </p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-sky-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">Saldo Meta Ads</span>
                  <FiDollarSign className="w-5 h-5 text-sky-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-sky-300 2xl:text-2xl">
                  {formatOptionalAdMoney(
                    summary.externalBalances?.metaAdsBalance?.availableBalance ?? summary.externalBalances?.metaAdsBalance?.balanceDue,
                    summary.externalBalances?.metaAdsBalance?.currency || 'BRL'
                  )}
                </div>
                <p
                  className="truncate text-xs text-gray-500 mt-1"
                  title={
                    summary.externalBalances?.metaAdsBalance?.error
                      ? summary.externalBalances.metaAdsBalance.error
                      : summary.externalBalances?.metaAdsBalance?.availableBalance != null
                        ? `Disponível: ${formatOptionalAdMoney(summary.externalBalances.metaAdsBalance.availableBalance, summary.externalBalances.metaAdsBalance.currency)} · Gasto: ${formatOptionalAdMoney(summary.externalBalances.metaAdsBalance.amountSpent, summary.externalBalances.metaAdsBalance.currency)} de ${formatOptionalAdMoney(summary.externalBalances.metaAdsBalance.spendCap, summary.externalBalances.metaAdsBalance.currency)}`
                        : `Em aberto: ${formatOptionalAdMoney(summary.externalBalances?.metaAdsBalance?.balanceDue, summary.externalBalances?.metaAdsBalance?.currency || 'BRL')}`
                  }
                >
                  {summary.externalBalances?.metaAdsBalance?.error
                    ? summary.externalBalances.metaAdsBalance.error
                    : summary.externalBalances?.metaAdsBalance?.availableBalance != null
                      ? `Disponível · ${summary.externalBalances.metaAdsBalance.adAccounts.length} conta(s)`
                      : 'Valor em aberto na Meta'}
                </p>
              </div>

              <div className="min-w-0 bg-gray-950/70 border border-blue-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate text-sm text-gray-400">IA de texto e imagem</span>
                  <FiCpu className="w-5 h-5 text-blue-400" />
                </div>
                <div className="whitespace-nowrap text-xl font-bold text-blue-300 2xl:text-2xl">
                  {formatUsd(summary.externalBalances?.openai?.costUsd)}
                </div>
                <p
                  className="truncate text-xs text-gray-500 mt-1"
                  title={
                    summary.externalBalances?.openai?.error
                      ? summary.externalBalances.openai.error
                      : summary.externalBalances?.openai?.monthlyBudgetUsd
                        ? `Mês: ${formatUsd(summary.externalBalances.openai.monthCostUsd)} de ${formatUsd(summary.externalBalances.openai.monthlyBudgetUsd)}`
                        : 'Custo de IA no período'
                  }
                >
                  {summary.externalBalances?.openai?.error
                    ? summary.externalBalances.openai.error
                    : summary.externalBalances?.openai?.monthlyBudgetUsd
                      ? `Mês: ${formatUsd(summary.externalBalances.openai.monthCostUsd)} de ${formatUsd(summary.externalBalances.openai.monthlyBudgetUsd)}`
                      : 'Custo de IA no período'}
                </p>
              </div>
          </div>

          <FinanceSalesChart series={summary.sales.series || []} />

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Onde gastou</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between gap-4 border-b border-gray-800 pb-2 mb-3">
                    <span className="font-semibold text-gray-200">Custo Fixo</span>
                    <span className="font-semibold text-orange-300">{formatMoney(summary.costs.fixed.total)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Supabase (banco de dados)</span>
                      <span className="font-medium">{formatMoney(summary.costs.fixed.supabase)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Vercel (hospedagem)</span>
                      <span className="font-medium">{formatMoney(summary.costs.fixed.vercel)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Resend (e-mails)</span>
                      <span className="font-medium">{formatMoney(summary.costs.fixed.resend)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between gap-4 border-b border-gray-800 pb-2 mb-3">
                    <span className="font-semibold text-gray-200">Custo Variável</span>
                    <span className="font-semibold text-orange-300">{formatMoney(summary.costs.variable.total)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Anúncios Meta ({summary.counts.metaAdCampaigns} anúncios)</span>
                      <span className="font-medium">
                        {formatAdMoney(summary.costs.variable.metaAds, summary.externalBalances?.metaAds?.currency || 'BRL')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Taxas Mercado Pago ({summary.paymentDetails.length} pagamento(s))</span>
                      <span className="font-medium">{formatMoney(summary.costs.variable.mercadoPagoFees)}</span>
                    </div>
                    <div className="rounded-lg border border-purple-900/40 bg-purple-950/10 p-3">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-300">IA musical / Suno ({summary.counts.musicGenerations} músicas, {summary.counts.lyricVideos} vídeos)</span>
                        <span className="font-medium">{formatMoney(summary.costs.variable.suno)}</span>
                      </div>
                      <div className="mt-2 space-y-1 border-t border-purple-900/40 pt-2 text-xs">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Músicas pagas ({summary.counts.paidMusicGenerations || 0})</span>
                          <span className="font-medium text-gray-300">{formatMoney(summary.costs.sunoPaidMusic || 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Músicas grátis ({summary.counts.freeMusicGenerations || 0})</span>
                          <span className="font-medium text-gray-300">{formatMoney(summary.costs.sunoFreeMusic || 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Vídeos com letra ({summary.counts.lyricVideos})</span>
                          <span className="font-medium text-gray-300">{formatMoney(summary.costs.sunoLyricVideos || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">IA criativa ({summary.counts.lyricGenerations} letras, {summary.counts.simpleCovers} capas simples, {summary.counts.premiumCovers} capas premium)</span>
                      <span className="font-medium">{formatMoney(summary.costs.variable.openAi)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3">De onde entrou</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Assinaturas pagas ({summary.counts.subscriptionPayments})</span>
                  <span className="font-medium">{formatMoney(summary.revenue.subscriptions)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Destaques pagos ({summary.counts.featuredPayments})</span>
                  <span className="font-medium">{formatMoney(summary.revenue.featured)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Recargas Studio IA ({summary.counts.studioTopupPayments})</span>
                  <span className="font-medium">{formatMoney(summary.revenue.studioTopups)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Vídeos com letra ({summary.counts.paidVideoRequests})</span>
                  <span className="font-medium">{formatMoney(summary.revenue.videos)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 mt-4">
            <h3 className="font-semibold mb-3">Gastos com anúncios</h3>
            {summary.externalBalances?.metaAds?.error && (
              <p className="text-sm text-yellow-300 mb-3">{summary.externalBalances.metaAds.error}</p>
            )}
            {metaAdGroups.length ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                  <div className="border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Cliques</p>
                    <p className="text-white font-semibold">{formatNumber(summary.counts.metaAdClicks)}</p>
                  </div>
                  <div className="border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Impressões</p>
                    <p className="text-white font-semibold">{formatNumber(summary.counts.metaAdImpressions)}</p>
                  </div>
                  <div className="border border-green-900/60 bg-green-950/20 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Cadastros reais (banco)</p>
                    <p className="text-green-300 font-semibold">{formatNumber(summary.counts.realRegistrationsInPeriod)}</p>
                    <p className="text-gray-500 text-[10px] mt-1">Contas criadas no período</p>
                  </div>
                  <div className="border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Cadastros reportados pela Meta</p>
                    <p className="text-white font-semibold">{formatNumber(summary.counts.metaAdRegistrations)}</p>
                    <p className="text-gray-500 text-[10px] mt-1">Estimativa do Facebook (pode duplicar)</p>
                  </div>
                  <div className="border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs">Custo por cadastro real</p>
                    <p className="text-white font-semibold">
                      {summary.counts.realRegistrationsInPeriod > 0
                        ? formatAdMoney(summary.costs.metaAds / summary.counts.realRegistrationsInPeriod, summary.externalBalances?.metaAds?.currency || 'BRL')
                        : '-'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Total de todas as campanhas. Ignorados (divulgação de música): {summary.externalBalances?.metaAds?.ignoredCount || 0} anúncio(s), {formatAdMoney(summary.externalBalances?.metaAds?.ignoredSpend || 0, summary.externalBalances?.metaAds?.currency || 'BRL')}.
                </p>

                {metaAdGroups.map(group => (
                  <div
                    key={group.key}
                    className="border border-gray-800 rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMetaGroup(group.key)}
                      className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 text-left hover:bg-gray-900/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-white">{group.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {group.items.length} anúncio(s) • {formatNumber(group.clicks)} cliques • {formatNumber(group.impressions)} impressões • {formatNumber(group.registrations)} cadastros
                        </p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-lg font-bold text-cyan-300">
                          {formatAdMoney(group.spend, summary.externalBalances?.metaAds?.currency || 'BRL')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {expandedMetaGroups[group.key] ? 'Clique para recolher' : 'Clique para expandir'}
                        </p>
                      </div>
                    </button>
                    {expandedMetaGroups[group.key] && (
                      <div className="border-t border-gray-800 bg-black/20 p-3 space-y-2">
                        {group.items.map(ad => (
                          <div key={`${ad.adAccountId}-${ad.adId}`} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-gray-800 bg-black/30 p-3">
                            <div>
                              <p className="text-sm font-medium text-gray-200">{ad.adName}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Conta {ad.adAccountId} • {formatNumber(ad.clicks)} cliques • {formatNumber(ad.impressions)} impressões
                              </p>
                            </div>
                            <div className="md:text-right">
                              <p className="font-bold text-cyan-300">
                                {formatAdMoney(ad.spend, summary.externalBalances?.metaAds?.currency || 'BRL')}
                              </p>
                              <p className="text-xs text-gray-500">
                                CPC {ad.cpc != null ? formatAdMoney(ad.cpc, summary.externalBalances?.metaAds?.currency || 'BRL') : '-'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Nenhum gasto de anúncio encontrado neste período.
              </p>
            )}
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 mt-4">
            <h3 className="font-semibold mb-3">E-mails e Resend</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">E-mails enviados</p>
                <p className="text-white font-semibold">{formatNumber(summary.counts.sentEmails)}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {formatNumber(summary.externalBalances?.resend?.transactionalEmails || 0)} transacionais + {formatNumber(summary.externalBalances?.resend?.campaignEmails || 0)} campanhas
                </p>
              </div>
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Custo variável estimado</p>
                <p className="text-white font-semibold">{formatMoney(summary.externalBalances?.resend?.variableCost || 0)}</p>
              </div>
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Plano fixo proporcional</p>
                <p className="text-white font-semibold">{formatMoney(summary.externalBalances?.resend?.fixedCost || 0)}</p>
              </div>
            </div>

            {summary.externalBalances?.resend?.categories?.length ? (
              <div className="space-y-2 text-sm">
                {summary.externalBalances.resend.categories.slice(0, 8).map(item => (
                  <div key={item.category} className="flex justify-between gap-4 border border-gray-800 rounded-lg px-3 py-2">
                    <span className="text-gray-400">{item.category}</span>
                    <span className="font-medium">{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum e-mail registrado neste período.</p>
            )}
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 mt-4">
            <h3 className="font-semibold mb-1">Custos fixos mensais (assinaturas)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Valores mensais em dólar convertidos para real (US$ 1 = {formatMoney(summary.costAssumptions.usdToBrl)}).
              No cálculo do lucro entram proporcionais aos {summary.externalBalances?.supabase?.periodDayCount || summary.externalBalances?.vercel?.periodDayCount || '-'} dia(s) do período selecionado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-300 font-medium">Supabase (banco)</p>
                <p className="text-gray-500 text-xs mt-1">Mensal</p>
                <p className="text-white font-semibold">{formatMoney(summary.costAssumptions.supabaseMonthlyFixed || 0)}</p>
                <p className="text-gray-500 text-xs mt-2">No período</p>
                <p className="text-white font-semibold">{formatMoney(summary.costs.fixed.supabase || 0)}</p>
              </div>
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-300 font-medium">Vercel (hospedagem)</p>
                <p className="text-gray-500 text-xs mt-1">Mensal</p>
                <p className="text-white font-semibold">{formatMoney(summary.costAssumptions.vercelMonthlyFixed || 0)}</p>
                <p className="text-gray-500 text-xs mt-2">No período</p>
                <p className="text-white font-semibold">{formatMoney(summary.costs.fixed.vercel || 0)}</p>
              </div>
              <div className="border border-gray-800 rounded-lg p-3">
                <p className="text-gray-300 font-medium">Resend (e-mails)</p>
                <p className="text-gray-500 text-xs mt-1">Mensal</p>
                <p className="text-white font-semibold">{formatMoney(summary.costAssumptions.resendMonthlyFixed || 0)}</p>
                <p className="text-gray-500 text-xs mt-2">No período</p>
                <p className="text-white font-semibold">{formatMoney(summary.costs.fixed.resend || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="font-semibold">Quem pagou no período</h3>
              {totalPayments > 0 && (
                <span className="text-xs text-gray-500">
                  {paymentsStartIndex + 1}-{Math.min(paymentsStartIndex + PAYMENTS_PER_PAGE, totalPayments)} de {totalPayments}
                </span>
              )}
            </div>
            {totalPayments > 0 ? (
              <>
                <div className="space-y-3">
                  {paginatedPayments.map(payment => (
                    <div
                      key={`${payment.source}-${payment.id}`}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-800 rounded-lg p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-white">{payment.customerName}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-primary-950/60 text-primary-300 border border-primary-900/70">
                            {payment.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{payment.customerEmail}</p>
                        <p className="text-xs text-gray-500 mt-1">{payment.description} • {formatDateTime(payment.paidAt)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Método: {payment.paymentMethod || 'não informado'} • Taxa Mercado Pago estimada: {formatMoney(payment.mercadoPagoFee || 0)}
                        </p>
                      </div>
                      <div className="text-lg font-bold text-green-300 md:text-right">
                        {formatMoney(payment.amount)}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPaymentPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-4">
                    <button
                      type="button"
                      onClick={() => setPaymentsPage(1)}
                      disabled={currentPaymentsPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Primeira página"
                    >
                      «
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentsPage(page => Math.max(1, page - 1))}
                      disabled={currentPaymentsPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Página anterior"
                    >
                      ‹
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-400">
                      Página {currentPaymentsPage} de {totalPaymentPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaymentsPage(page => Math.min(totalPaymentPages, page + 1))}
                      disabled={currentPaymentsPage === totalPaymentPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Próxima página"
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentsPage(totalPaymentPages)}
                      disabled={currentPaymentsPage === totalPaymentPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Última página"
                    >
                      »
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Nenhum pagamento aprovado neste período.</p>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Premissas: IA musical {formatMoney(summary.costAssumptions.musicGeneration)} por música, vídeo com capa/letra {formatMoney(summary.costAssumptions.lyricVideo)}; letra IA {formatMoney(summary.costAssumptions.lyricGeneration)} cada, capa simples {formatMoney(summary.costAssumptions.simpleCover)} cada, capa premium {formatMoney(summary.costAssumptions.premiumCover)} cada (custo de benefício dos planos); Mercado Pago Pix {formatPercent(summary.costAssumptions.mercadoPagoPixRate * 100)} e cartão/outros {formatPercent(summary.costAssumptions.mercadoPagoCardRate * 100)}; IA criativa (OpenAI) usa o custo real em dólar convertido a US$ 1 = {formatMoney(summary.costAssumptions.openAiUsdToBrl)}. Custos fixos mensais: Supabase {formatMoney(summary.costAssumptions.supabaseMonthlyFixed)}, Vercel {formatMoney(summary.costAssumptions.vercelMonthlyFixed)}, Resend {formatMoney(summary.costAssumptions.resendMonthlyFixed)} (proporcionais aos dias do período). Anúncios Meta são puxados direto da conta.
          </p>
        </>
      ) : null}
    </section>
  )
}
