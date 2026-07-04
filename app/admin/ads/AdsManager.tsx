'use client'

import { useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiSettings,
} from 'react-icons/fi'

type AdRow = {
  adAccountId: string
  adId: string
  adName: string
  adsetId: string
  adsetName: string
  campaignId: string
  campaignName: string
  spend: number
  clicks: number
  impressions: number
  cpc: number | null
  registrations: number
  registrationSource: string | null
  purchases: number
  purchaseSource: string | null
  purchaseValue: number
  linkClicks: number
  landingPageViews: number
  primaryResultType: string | null
  primaryResultLabel: string
  primaryResultValue: number
  analysisLabel: string
  analysisTone: 'good' | 'watch' | 'danger' | 'neutral'
  status?: string | null
  effectiveStatus?: string | null
  costPerRegistration: number | null
  recommendation: string
  consideredStudio: boolean
}

type AdsResponse = {
  configured: boolean
  error?: string
  days?: number
  since?: string
  until?: string
  ads?: AdRow[]
  ignoredCount?: number
  ignoredSpend?: number
  errors?: string[]
}

type CampaignGroup = {
  campaignId: string
  campaignName: string
  spend: number
  linkClicks: number
  clicks: number
  registrations: number
  purchases: number
  purchaseValue: number
  costPerRegistration: number | null
  costPerPurchase: number | null
  ads: AdRow[]
  isActive: boolean
  isPaused: boolean
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function isPausedStatus(value?: string | null) {
  return value === 'PAUSED' || value === 'CAMPAIGN_PAUSED' || value === 'ADSET_PAUSED'
}

function isAdPaused(ad: AdRow) {
  return isPausedStatus(ad.status) || isPausedStatus(ad.effectiveStatus)
}

function isAdActive(ad: AdRow) {
  return ad.status === 'ACTIVE' || ad.effectiveStatus === 'ACTIVE'
}

function toneClasses(tone: AdRow['analysisTone']) {
  if (tone === 'good') return 'border-green-700 bg-green-950/40 text-green-200'
  if (tone === 'watch') return 'border-yellow-700 bg-yellow-950/40 text-yellow-100'
  if (tone === 'danger') return 'border-red-700 bg-red-950/40 text-red-100'
  return 'border-gray-700 bg-gray-900 text-gray-200'
}

// Veredito da campanha em linguagem simples
function campaignVerdict(campaign: CampaignGroup): { label: string; tone: AdRow['analysisTone'] } {
  if (campaign.purchases > 0) {
    return { label: `Gerou ${formatNumber(campaign.purchases)} compra(s)`, tone: 'good' }
  }
  if (campaign.registrations > 0) {
    const cost = campaign.costPerRegistration || 0
    if (cost > 0 && cost <= 6) return { label: 'Trazendo cadastros baratos', tone: 'good' }
    if (cost > 0 && cost <= 12) return { label: 'Trazendo cadastros (custo ok)', tone: 'watch' }
    return { label: 'Cadastros caros, vale revisar', tone: 'danger' }
  }
  const clicks = campaign.linkClicks || campaign.clicks
  if (clicks >= 20) return { label: 'Tem cliques, mas sem cadastro/compra atribuído', tone: 'watch' }
  if (campaign.spend >= 20) return { label: 'Gastou sem resultado claro', tone: 'danger' }
  if (campaign.spend > 0) return { label: 'Poucos dados ainda', tone: 'neutral' }
  return { label: 'Sem gasto no período', tone: 'neutral' }
}

export default function AdsManager() {
  const [data, setData] = useState<AdsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [includeIgnored, setIncludeIgnored] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadAds = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/ads?days=${days}&includeIgnored=${includeIgnored ? '1' : '0'}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.details || payload.error || 'Erro ao consultar anúncios')
      setData(payload)
    } catch (error: any) {
      console.error('[ADS] Erro:', error)
      setData({ configured: false, error: error.message, ads: [] })
    } finally {
      setLoading(false)
    }
  }

  const allAds = data?.ads || []

  // Agrupa por campanha usando TODOS os anúncios, depois filtra a campanha por status.
  const campaigns = useMemo<CampaignGroup[]>(() => {
    const byId = new Map<string, CampaignGroup>()

    allAds.forEach((ad) => {
      const current = byId.get(ad.campaignId) || {
        campaignId: ad.campaignId,
        campaignName: ad.campaignName,
        spend: 0,
        linkClicks: 0,
        clicks: 0,
        registrations: 0,
        purchases: 0,
        purchaseValue: 0,
        costPerRegistration: null,
        costPerPurchase: null,
        ads: [],
        isActive: false,
        isPaused: false,
      }
      current.spend += ad.spend
      current.linkClicks += ad.linkClicks
      current.clicks += ad.clicks
      current.registrations += ad.registrations
      current.purchases += Number(ad.purchases || 0)
      current.purchaseValue += Number(ad.purchaseValue || 0)
      current.ads.push(ad)
      byId.set(ad.campaignId, current)
    })

    return Array.from(byId.values())
      .map((campaign) => {
        const campaignPaused = campaign.ads.every((ad) => isAdPaused(ad) || ad.effectiveStatus === 'CAMPAIGN_PAUSED')
        const hasActive = campaign.ads.some((ad) => isAdActive(ad) && ad.effectiveStatus !== 'CAMPAIGN_PAUSED')
        return {
          ...campaign,
          costPerRegistration: campaign.registrations > 0 ? campaign.spend / campaign.registrations : null,
          costPerPurchase: campaign.purchases > 0 ? campaign.spend / campaign.purchases : null,
          isActive: hasActive,
          isPaused: !hasActive && campaignPaused,
          ads: campaign.ads.sort((a, b) => b.spend - a.spend),
        }
      })
      .sort((a, b) => {
        // Ativas primeiro, depois por gasto
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        return b.spend - a.spend
      })
  }, [allAds])

  const visibleCampaigns = useMemo(() => {
    if (statusFilter === 'active') return campaigns.filter((c) => c.isActive)
    if (statusFilter === 'inactive') return campaigns.filter((c) => !c.isActive)
    return campaigns
  }, [campaigns, statusFilter])

  const totals = useMemo(() => {
    const list = visibleCampaigns
    return {
      spend: list.reduce((sum, c) => sum + c.spend, 0),
      linkClicks: list.reduce((sum, c) => sum + (c.linkClicks || c.clicks), 0),
      registrations: list.reduce((sum, c) => sum + c.registrations, 0),
      purchases: list.reduce((sum, c) => sum + c.purchases, 0),
      purchaseValue: list.reduce((sum, c) => sum + c.purchaseValue, 0),
    }
  }, [visibleCampaigns])

  const costPerRegistration = totals.registrations > 0 ? totals.spend / totals.registrations : null

  const riskyAds = useMemo(() => allAds.filter((ad) => (
    ad.spend >= 20 &&
    ad.registrations === 0 &&
    ad.purchases === 0 &&
    (ad.linkClicks || ad.clicks) < 10 &&
    !isAdPaused(ad)
  )), [allAds])

  const toggleExpand = (campaignId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(campaignId)) next.delete(campaignId)
      else next.add(campaignId)
      return next
    })
  }

  const updateStatusLocally = (type: 'ad' | 'campaign', id: string, status: 'ACTIVE' | 'PAUSED') => {
    setData((current) => {
      if (!current) return current
      const ads = (current.ads || []).map((ad) => {
        if (type === 'ad' && ad.adId === id) {
          return { ...ad, status, effectiveStatus: status }
        }
        if (type === 'campaign' && ad.campaignId === id) {
          return { ...ad, status, effectiveStatus: status === 'PAUSED' ? 'CAMPAIGN_PAUSED' : 'ACTIVE' }
        }
        return ad
      })
      return { ...current, ads }
    })
  }

  const changeStatus = async (type: 'ad' | 'campaign', id: string, status: 'ACTIVE' | 'PAUSED', label: string) => {
    const verb = status === 'PAUSED' ? 'pausar' : 'reativar'
    const confirmed = window.confirm(`Tem certeza que deseja ${verb} ${type === 'campaign' ? 'a campanha' : 'o anúncio'} "${label}"?`)
    if (!confirmed) return

    try {
      setActionLoading(`${type}-${id}`)
      const response = await fetch('/api/admin/ads/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.hint ? `${payload.error}\n\n${payload.hint}` : payload.error || 'Erro ao alterar status')
      updateStatusLocally(type, id, status)
    } catch (error: any) {
      alert(error.message || 'Erro ao alterar status')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-3xl border border-purple-800/50 bg-gradient-to-br from-purple-950/30 via-gray-950 to-black p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-100">
              <FiSettings />
              Meta Ads
            </div>
            <h1 className="text-3xl font-black sm:text-4xl">
              <span className="gradient-text">Minhas campanhas</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Veja quanto cada campanha gastou, quantos cadastros e compras trouxe, e pause ou reative direto por aqui.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={days}
              onChange={(event) => {
                setDays(Number(event.target.value))
                setData(null)
              }}
              className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={14}>Últimos 14 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
            <button
              type="button"
              onClick={loadAds}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros de status */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {([
            { id: 'active', label: 'Ativas' },
            { id: 'inactive', label: 'Pausadas' },
            { id: 'all', label: 'Todas' },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                statusFilter === option.id
                  ? 'bg-white text-gray-900'
                  : 'border border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-500'
              }`}
            >
              {option.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={includeIgnored}
              onChange={(event) => {
                setIncludeIgnored(event.target.checked)
                setData(null)
              }}
              className="accent-purple-500"
            />
            Incluir campanhas de música/outras
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">
          <FiRefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-purple-300" />
          Consultando Meta Ads...
        </div>
      ) : !data ? (
        <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">
          Escolha o período e clique em Atualizar para consultar a Meta Ads.
        </div>
      ) : !data?.configured ? (
        <div className="rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6 text-yellow-100">
          <div className="mb-2 flex items-center gap-2 font-bold">
            <FiAlertTriangle />
            Configuração incompleta
          </div>
          <p className="text-sm">{data?.error || 'Configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID na Vercel.'}</p>
        </div>
      ) : (
        <>
          {Array.isArray(data.errors) && data.errors.length > 0 && (
            <div className="rounded-2xl border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-100">
              <strong>Aviso:</strong> {data.errors.join(' | ')}
            </div>
          )}

          {/* Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Gasto no período" value={formatMoney(totals.spend)} hint={`${visibleCampaigns.length} campanha(s)`} />
            <SummaryCard label="Cadastros" value={formatNumber(totals.registrations)} hint="Eventos do Pixel (cadastro/lead)" />
            <SummaryCard
              label="Compras"
              value={formatNumber(totals.purchases)}
              hint={totals.purchaseValue > 0 ? formatMoney(totals.purchaseValue) : 'Atribuídas pela Meta'}
              tone={totals.purchases > 0 ? 'ok' : 'default'}
            />
            <SummaryCard
              label="Custo por cadastro"
              value={costPerRegistration == null ? '—' : formatMoney(costPerRegistration)}
              hint={costPerRegistration == null ? 'Sem cadastro no período' : 'Gasto ÷ cadastros'}
            />
          </div>

          {riskyAds.length > 0 && (
            <div className="rounded-2xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-100">
              <div className="flex items-center gap-2 font-bold">
                <FiAlertTriangle />
                {riskyAds.length} anúncio(s) gastando sem resultado
              </div>
              <p className="mt-1 text-red-200/80">
                Gastaram R$ 20 ou mais, com poucos cliques e nenhum cadastro/compra. Veja dentro das campanhas e considere pausar.
              </p>
            </div>
          )}

          {/* Campanhas */}
          <section className="space-y-4">
            {visibleCampaigns.length === 0 ? (
              <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">
                Nenhuma campanha {statusFilter === 'active' ? 'ativa' : statusFilter === 'inactive' ? 'pausada' : ''} encontrada neste período.
              </div>
            ) : visibleCampaigns.map((campaign) => {
              const verdict = campaignVerdict(campaign)
              const isOpen = expanded.has(campaign.campaignId)
              const actionKey = `campaign-${campaign.campaignId}`

              return (
                <div key={campaign.campaignId} className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950/70">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${campaign.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                          <span className={`text-xs font-bold ${campaign.isActive ? 'text-green-300' : 'text-gray-400'}`}>
                            {campaign.isActive ? 'Ativa' : 'Pausada'}
                          </span>
                        </div>
                        <h3 className="mt-1 truncate text-lg font-black text-white">{campaign.campaignName}</h3>
                        <span className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${toneClasses(verdict.tone)}`}>
                          {verdict.label}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-black text-white">{formatMoney(campaign.spend)}</p>
                          <p className="text-xs text-gray-500">
                            {campaign.purchases > 0
                              ? `Custo/compra ${campaign.costPerPurchase == null ? '—' : formatMoney(campaign.costPerPurchase)}`
                              : `Custo/cadastro ${campaign.costPerRegistration == null ? '—' : formatMoney(campaign.costPerRegistration)}`}
                          </p>
                        </div>
                        {campaign.isActive ? (
                          <button
                            type="button"
                            disabled={actionLoading === actionKey}
                            onClick={() => changeStatus('campaign', campaign.campaignId, 'PAUSED', campaign.campaignName)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/40 px-4 py-2.5 text-sm font-bold text-red-100 hover:border-red-400 disabled:opacity-50"
                          >
                            <FiPauseCircle />
                            Pausar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading === actionKey}
                            onClick={() => changeStatus('campaign', campaign.campaignId, 'ACTIVE', campaign.campaignName)}
                            className="inline-flex items-center gap-2 rounded-xl border border-green-800 bg-green-950/40 px-4 py-2.5 text-sm font-bold text-green-100 hover:border-green-400 disabled:opacity-50"
                          >
                            <FiPlayCircle />
                            Reativar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Números principais */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MiniStat label="Cliques no link" value={formatNumber(campaign.linkClicks || campaign.clicks)} />
                      <MiniStat label="Cadastros" value={formatNumber(campaign.registrations)} />
                      <MiniStat label="Compras" value={formatNumber(campaign.purchases)} highlight={campaign.purchases > 0} />
                      <MiniStat label="Anúncios" value={formatNumber(campaign.ads.length)} />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(campaign.campaignId)}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-purple-300 hover:text-purple-200"
                    >
                      {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                      {isOpen ? 'Ocultar anúncios' : `Ver anúncios (${campaign.ads.length})`}
                    </button>
                  </div>

                  {/* Anúncios da campanha */}
                  {isOpen && (
                    <div className="border-t border-gray-800 bg-black/30 p-4 sm:p-5">
                      <div className="space-y-3">
                        {campaign.ads.map((ad) => {
                          const paused = isAdPaused(ad)
                          const pausedByParent = ad.effectiveStatus === 'CAMPAIGN_PAUSED' || ad.effectiveStatus === 'ADSET_PAUSED'
                          const adActionKey = `ad-${ad.adId}`

                          return (
                            <div key={`${ad.adAccountId}-${ad.adId}-${ad.adName}`} className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">{ad.adName}</p>
                                  <p className="mt-0.5 truncate text-xs text-gray-500">{ad.adsetName}</p>
                                  <span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${toneClasses(ad.analysisTone)}`}>
                                    {ad.analysisLabel}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <div className="text-right">
                                    <p className="font-black text-white">{formatMoney(ad.spend)}</p>
                                    <p className="text-xs text-gray-500">
                                      {formatNumber(ad.linkClicks || ad.clicks)} cliques · {formatNumber(ad.registrations)} cad.
                                    </p>
                                  </div>
                                  {pausedByParent ? (
                                    <span className="inline-flex rounded-lg border border-yellow-800 bg-yellow-950/40 px-3 py-2 text-xs font-bold text-yellow-100">
                                      Campanha pausada
                                    </span>
                                  ) : paused ? (
                                    <button
                                      type="button"
                                      disabled={actionLoading === adActionKey || !ad.adId}
                                      onClick={() => changeStatus('ad', ad.adId, 'ACTIVE', ad.adName)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-green-800 bg-green-950/40 px-3 py-2 text-xs font-bold text-green-100 hover:border-green-400 disabled:opacity-50"
                                    >
                                      <FiPlayCircle />
                                      Ativar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={actionLoading === adActionKey || !ad.adId}
                                      onClick={() => changeStatus('ad', ad.adId, 'PAUSED', ad.adName)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-bold text-red-100 hover:border-red-400 disabled:opacity-50"
                                    >
                                      <FiPauseCircle />
                                      Pausar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {/* Explicação */}
          <div className="flex gap-3 rounded-2xl border border-blue-800/60 bg-blue-950/20 p-4 text-sm text-blue-100">
            <FiInfo className="mt-0.5 shrink-0" />
            <p>
              <strong>Como ler:</strong> “Cadastros” e “Compras” são eventos que o Pixel da Meta conseguiu atribuir ao anúncio.
              Quando uma campanha tem muitos cliques e zero cadastros, normalmente significa que a Meta não conseguiu atribuir o evento
              (não quer dizer que não trouxe visitas ou vendas). Use os cliques no link como sinal de tráfego.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'danger' | 'ok' }) {
  const color = tone === 'danger' ? 'text-red-300' : tone === 'ok' ? 'text-green-300' : 'text-white'
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function MiniStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${highlight ? 'text-green-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}
