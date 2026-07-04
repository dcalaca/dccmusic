import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type MetaAdRow = {
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
}

// Campanhas/anúncios de divulgação de música que não devem aparecer por padrão
// (não são campanhas de cadastro/venda do Studio IA). Ainda podem ser vistos com "Mostrar ignorados".
const META_ADS_EXCLUDE_PATTERNS = [
  'tem amores que passam',
  'vicio bom',
  'u0eu791h',
]

function normalizeMetaAdAccountId(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`
}

function getMetaAdAccountIds() {
  const rawValue = process.env.META_AD_ACCOUNT_IDS || process.env.META_AD_ACCOUNT_ID || ''
  return Array.from(new Set(
    rawValue
      .split(/[,\s;]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeMetaAdAccountId)
  ))
}

function normalizeMetaName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function shouldConsiderMetaAd(row: { campaignName: string; adName: string }) {
  const name = normalizeMetaName(`${row.campaignName} ${row.adName}`)
  // Mostra todas as campanhas por padrão; só esconde as explicitamente excluídas.
  return !META_ADS_EXCLUDE_PATTERNS.some((pattern) => name.includes(pattern))
}

function extractMetaRegistrations(actions: any[] | undefined) {
  if (!Array.isArray(actions)) {
    return {
      registrations: 0,
      registrationSource: null,
    }
  }

  const candidates = actions
    .map((action) => {
      const type = String(action?.action_type || '').toLowerCase()
      const value = Number(action?.value) || 0
      return { type, value }
    })
    .filter((action) => (
      action.value > 0 &&
      (
        action.type === 'complete_registration' ||
        action.type === 'offsite_conversion.fb_pixel_complete_registration' ||
        action.type.includes('complete_registration') ||
        action.type === 'lead' ||
        action.type === 'omni_lead' ||
        action.type === 'offsite_conversion.fb_pixel_lead' ||
        action.type.includes('lead_grouped') ||
        action.type.includes('fb_pixel_lead')
      )
    ))

  if (candidates.length === 0) {
    return {
      registrations: 0,
      registrationSource: null,
    }
  }

  // A Meta pode retornar variações do mesmo evento. Para não inflar cadastro,
  // usamos o maior valor entre os eventos de registro equivalentes.
  const best = candidates.sort((a, b) => b.value - a.value)[0]

  return {
    registrations: best.value,
    registrationSource: best.type,
  }
}

function extractMetaPurchases(actions: any[] | undefined, actionValues: any[] | undefined) {
  const purchaseTypes = (rows: any[] | undefined) => (
    Array.isArray(rows)
      ? rows
        .map((action) => {
          const type = String(action?.action_type || '').toLowerCase()
          const value = Number(action?.value) || 0
          return { type, value }
        })
        .filter((action) => (
          action.value > 0 &&
          (
            action.type === 'purchase' ||
            action.type === 'omni_purchase' ||
            action.type === 'offsite_conversion.fb_pixel_purchase' ||
            action.type.includes('purchase')
          )
        ))
      : []
  )

  const purchaseActions = purchaseTypes(actions)
  const purchaseValues = purchaseTypes(actionValues)

  if (purchaseActions.length === 0 && purchaseValues.length === 0) {
    return {
      purchases: 0,
      purchaseSource: null,
      purchaseValue: 0,
    }
  }

  const bestPurchase = purchaseActions.sort((a, b) => b.value - a.value)[0]
  const bestValue = purchaseValues.sort((a, b) => b.value - a.value)[0]

  return {
    purchases: bestPurchase?.value || 0,
    purchaseSource: bestPurchase?.type || bestValue?.type || null,
    purchaseValue: bestValue?.value || 0,
  }
}

function sumAction(actions: any[] | undefined, matcher: (type: string) => boolean) {
  if (!Array.isArray(actions)) return 0
  return actions.reduce((total, action) => {
    const type = String(action?.action_type || '').toLowerCase()
    return matcher(type) ? total + (Number(action?.value) || 0) : total
  }, 0)
}

function actionLabel(type?: string | null) {
  const normalized = String(type || '').toLowerCase()
  if (normalized.includes('complete_registration')) return 'Cadastros'
  if (normalized.includes('purchase')) return 'Compras'
  if (normalized.includes('lead')) return 'Cadastros/Leads'
  if (normalized === 'link_click' || normalized.includes('link_click')) return 'Cliques no link'
  if (normalized.includes('landing_page_view')) return 'Visualizações da página'
  if (normalized.includes('page_engagement')) return 'Engajamentos'
  if (normalized.includes('post_engagement')) return 'Engajamentos no post'
  if (normalized.includes('comment')) return 'Comentários'
  if (normalized.includes('like')) return 'Curtidas'
  if (normalized.includes('video_view')) return 'Visualizações de vídeo'
  return type || 'Resultado'
}

function getPrimaryResult(actions: any[] | undefined, registrations: number, purchases: number, linkClicks: number, landingPageViews: number) {
  if (purchases > 0) {
    return {
      primaryResultType: 'purchase',
      primaryResultLabel: 'Compras',
      primaryResultValue: purchases,
    }
  }

  if (registrations > 0) {
    return {
      primaryResultType: 'complete_registration',
      primaryResultLabel: 'Cadastros',
      primaryResultValue: registrations,
    }
  }

  if (landingPageViews > 0) {
    return {
      primaryResultType: 'landing_page_view',
      primaryResultLabel: 'Visualizações da página',
      primaryResultValue: landingPageViews,
    }
  }

  if (linkClicks > 0) {
    return {
      primaryResultType: 'link_click',
      primaryResultLabel: 'Cliques no link',
      primaryResultValue: linkClicks,
    }
  }

  const rows = Array.isArray(actions) ? actions : []
  const bestAction = rows
    .map((action) => ({
      type: String(action?.action_type || ''),
      value: Number(action?.value) || 0,
    }))
    .filter((action) => action.value > 0)
    .sort((a, b) => b.value - a.value)[0]

  return {
    primaryResultType: bestAction?.type || null,
    primaryResultLabel: actionLabel(bestAction?.type),
    primaryResultValue: bestAction?.value || 0,
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function getMetaObjectStatus(id: string, accessToken: string, apiVersion: string) {
  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'status,effective_status',
    })
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${id}?${params.toString()}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.error) return { status: null, effectiveStatus: null }
    return {
      status: payload?.status || null,
      effectiveStatus: payload?.effective_status || null,
    }
  } catch {
    return { status: null, effectiveStatus: null }
  }
}

function buildRecommendation(row: MetaAdRow) {
  if (row.spend <= 0) return 'Sem gasto no período'
  if (row.purchases > 0) return 'Tem compra atribuída'
  if (row.registrations > 0) {
    const cost = row.spend / row.registrations
    if (cost <= 5) return 'Bom custo por cadastro'
    if (cost <= 12) return 'Acompanhar'
    return 'Custo alto, revisar criativo/público'
  }
  if (row.linkClicks >= 20 || row.clicks >= 20) return 'Tem cliques, mas sem cadastro atribuído ao Pixel'
  if (row.spend >= 20) return 'Gastou sem resultado claro, revisar'
  return 'Poucos dados ainda'
}

function buildAnalysis(row: Omit<MetaAdRow, 'analysisLabel' | 'analysisTone'>): Pick<MetaAdRow, 'analysisLabel' | 'analysisTone'> {
  if (row.purchases > 0) {
    return { analysisLabel: 'Gerou compra atribuída', analysisTone: 'good' }
  }

  const costPerRegistration = row.registrations > 0 ? row.spend / row.registrations : null
  const effectiveClicks = row.linkClicks || row.clicks
  const costPerClick = effectiveClicks > 0 ? row.spend / effectiveClicks : null
  const costPerLandingPageView = row.landingPageViews > 0 ? row.spend / row.landingPageViews : null

  if (row.registrations > 0) {
    if ((costPerRegistration || 0) <= 5) {
      return { analysisLabel: 'Ótima para cadastro', analysisTone: 'good' }
    }
    if ((costPerRegistration || 0) <= 12) {
      return { analysisLabel: 'Cadastro com custo aceitável', analysisTone: 'watch' }
    }
    return { analysisLabel: 'Cadastro caro, revisar', analysisTone: 'danger' }
  }

  if (row.landingPageViews >= 100 && (costPerLandingPageView || 999) <= 0.6) {
    return { analysisLabel: 'Boa para tráfego, sem cadastro atribuído', analysisTone: 'good' }
  }

  if (effectiveClicks >= 100 && (costPerClick || 999) <= 0.4) {
    return { analysisLabel: 'Bom tráfego barato, sem cadastro atribuído', analysisTone: 'good' }
  }

  if (effectiveClicks >= 20) {
    return { analysisLabel: 'Tem tráfego, verificar conversão no site', analysisTone: 'watch' }
  }

  if (row.spend >= 20) {
    return { analysisLabel: 'Gasto sem resposta clara', analysisTone: 'danger' }
  }

  return { analysisLabel: 'Poucos dados para decidir', analysisTone: 'neutral' }
}

function emptyMetaAdRow(input: {
  adAccountId: string
  adId: string
  adName: string
  adsetId: string
  adsetName: string
  campaignId: string
  campaignName: string
  status?: string | null
  effectiveStatus?: string | null
}): MetaAdRow {
  const baseRow = {
    adAccountId: input.adAccountId,
    adId: input.adId,
    adName: input.adName,
    adsetId: input.adsetId,
    adsetName: input.adsetName,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    spend: 0,
    clicks: 0,
    impressions: 0,
    cpc: null,
    registrations: 0,
    registrationSource: null,
    purchases: 0,
    purchaseSource: null,
    purchaseValue: 0,
    linkClicks: 0,
    landingPageViews: 0,
    primaryResultType: null,
    primaryResultLabel: 'Resultado',
    primaryResultValue: 0,
    status: input.status || null,
    effectiveStatus: input.effectiveStatus || null,
  }

  return {
    ...baseRow,
    ...buildAnalysis(baseRow),
  }
}

async function fetchActiveAdsWithoutInsights(input: {
  adAccountId: string
  accessToken: string
  apiVersion: string
}) {
  const activeAds: MetaAdRow[] = []
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,name,status,effective_status,adset{id,name,status,effective_status},campaign{id,name,status,effective_status}',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: '100',
  })
  let nextUrl: string | null = `https://graph.facebook.com/${input.apiVersion}/${input.adAccountId}/ads?${params.toString()}`

  while (nextUrl) {
    const response = await fetch(nextUrl, { cache: 'no-store' })
    const payload: any = await response.json().catch(() => null)
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error?.message || 'não foi possível consultar anúncios ativos')
    }

    const rows = Array.isArray(payload?.data) ? payload.data : []
    rows.forEach((row: any) => {
      const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign
      const adset = Array.isArray(row.adset) ? row.adset[0] : row.adset
      activeAds.push(emptyMetaAdRow({
        adAccountId: input.adAccountId,
        adId: row.id || '',
        adName: row.name || 'Anúncio sem nome',
        adsetId: adset?.id || '',
        adsetName: adset?.name || 'Conjunto sem nome',
        campaignId: campaign?.id || '',
        campaignName: campaign?.name || 'Campanha sem nome',
        status: row.status || null,
        effectiveStatus: row.effective_status || null,
      }))
    })

    nextUrl = payload?.paging?.next || null
  }

  return activeAds
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const accessToken = process.env.META_ACCESS_TOKEN
    const adAccountIds = getMetaAdAccountIds()
    if (!accessToken || adAccountIds.length === 0) {
      return NextResponse.json({
        configured: false,
        error: 'META_ACCESS_TOKEN e META_AD_ACCOUNT_ID ou META_AD_ACCOUNT_IDS não configurados',
        ads: [],
        campaigns: [],
      })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || 30)))
    const includeIgnored = searchParams.get('includeIgnored') === '1'
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0'
    const untilDate = new Date()
    const sinceDate = addDays(untilDate, -days + 1)
    const since = sinceDate.toISOString().slice(0, 10)
    const until = untilDate.toISOString().slice(0, 10)
    const ads: MetaAdRow[] = []
    const ignoredAds: MetaAdRow[] = []
    const errors: string[] = []

    for (const adAccountId of adAccountIds) {
      try {
        const activeRows = await fetchActiveAdsWithoutInsights({ adAccountId, accessToken, apiVersion })
        activeRows.forEach((row) => {
          if (shouldConsiderMetaAd(row)) ads.push(row)
          else ignoredAds.push(row)
        })
      } catch (error: any) {
        errors.push(`${adAccountId}: ativos: ${error.message || 'não foi possível consultar anúncios ativos'}`)
      }

      const params = new URLSearchParams({
        access_token: accessToken,
        level: 'ad',
        fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,clicks,impressions,cpc,actions,action_values',
        time_range: JSON.stringify({ since, until }),
        limit: '100',
      })

      let nextUrl: string | null = `https://graph.facebook.com/${apiVersion}/${adAccountId}/insights?${params.toString()}`

      while (nextUrl) {
        const response = await fetch(nextUrl, { cache: 'no-store' })
        const payload: any = await response.json().catch(() => null)

        if (!response.ok || payload?.error) {
          errors.push(`${adAccountId}: ${payload?.error?.message || 'não foi possível consultar'}`)
          break
        }

        const rows = Array.isArray(payload?.data) ? payload.data : []
        const mappedRows = await Promise.all(rows.map(async (row: any) => {
          const status = row.ad_id ? await getMetaObjectStatus(row.ad_id, accessToken, apiVersion) : { status: null, effectiveStatus: null }
          const registrationResult = extractMetaRegistrations(row.actions)
          const registrations = registrationResult.registrations
          const purchaseResult = extractMetaPurchases(row.actions, row.action_values)
          const purchases = purchaseResult.purchases
          const linkClicks = sumAction(row.actions, (type) => type === 'link_click' || type.includes('link_click'))
          const landingPageViews = sumAction(row.actions, (type) => type.includes('landing_page_view'))
          const primaryResult = getPrimaryResult(row.actions, registrations, purchases, linkClicks, landingPageViews)

          const baseRow = {
            adAccountId,
            adId: row.ad_id || '',
            adName: row.ad_name || 'Anúncio sem nome',
            adsetId: row.adset_id || '',
            adsetName: row.adset_name || 'Conjunto sem nome',
            campaignId: row.campaign_id || '',
            campaignName: row.campaign_name || 'Campanha sem nome',
            spend: Number(row.spend) || 0,
            clicks: Number(row.clicks) || 0,
            impressions: Number(row.impressions) || 0,
            cpc: row.cpc != null ? Number(row.cpc) || 0 : null,
            registrations,
            registrationSource: registrationResult.registrationSource,
            purchases,
            purchaseSource: purchaseResult.purchaseSource,
            purchaseValue: purchaseResult.purchaseValue,
            linkClicks,
            landingPageViews,
            ...primaryResult,
            status: status.status,
            effectiveStatus: status.effectiveStatus,
          }
          return {
            ...baseRow,
            ...buildAnalysis(baseRow),
          }
        }))

        mappedRows.forEach((row) => {
          if (shouldConsiderMetaAd(row)) ads.push(row)
          else ignoredAds.push(row)
        })

        nextUrl = payload?.paging?.next || null
      }
    }

    const dedupeByAdId = (rows: MetaAdRow[]) => {
      const byId = new Map<string, MetaAdRow>()
      rows.forEach((row) => {
        const key = row.adId || `${row.adAccountId}:${row.campaignId}:${row.adsetId}:${row.adName}`
        const existing = byId.get(key)
        if (
          !existing ||
          row.spend > existing.spend ||
          row.clicks > existing.clicks ||
          row.impressions > existing.impressions ||
          row.registrations > existing.registrations ||
          row.purchases > existing.purchases
        ) {
          byId.set(key, row)
        }
      })
      return Array.from(byId.values())
    }

    const consideredAds = dedupeByAdId(ads)
    const consideredIds = new Set(consideredAds.map((row) => row.adId).filter(Boolean))
    const consideredIgnoredAds = dedupeByAdId(ignoredAds.filter((row) => !row.adId || !consideredIds.has(row.adId)))
    const selectedAds = includeIgnored ? [...consideredAds, ...consideredIgnoredAds] : consideredAds
    const campaignsById = new Map<string, any>()

    selectedAds.forEach((ad) => {
      const campaign = campaignsById.get(ad.campaignId) || {
        campaignId: ad.campaignId,
        campaignName: ad.campaignName,
        spend: 0,
        clicks: 0,
        impressions: 0,
        registrations: 0,
        purchases: 0,
        purchaseValue: 0,
        linkClicks: 0,
        primaryResults: 0,
        ads: 0,
      }
      campaign.spend += ad.spend
      campaign.clicks += ad.clicks
      campaign.impressions += ad.impressions
      campaign.registrations += ad.registrations
      campaign.purchases += ad.purchases
      campaign.purchaseValue += ad.purchaseValue
      campaign.linkClicks += ad.linkClicks
      campaign.primaryResults += ad.primaryResultValue
      campaign.ads += 1
      campaignsById.set(ad.campaignId, campaign)
    })

    const decoratedAds = selectedAds
      .sort((a, b) => b.spend - a.spend)
      .map((ad) => ({
        ...ad,
        costPerRegistration: ad.registrations > 0 ? ad.spend / ad.registrations : null,
        recommendation: buildRecommendation(ad),
        consideredStudio: shouldConsiderMetaAd(ad),
      }))

    const campaigns = Array.from(campaignsById.values())
      .sort((a, b) => b.spend - a.spend)
      .map((campaign) => ({
        ...campaign,
        costPerRegistration: campaign.registrations > 0 ? campaign.spend / campaign.registrations : null,
        costPerPurchase: campaign.purchases > 0 ? campaign.spend / campaign.purchases : null,
        recommendation: campaign.purchases > 0
          ? 'Com compra atribuída'
          : campaign.registrations > 0
            ? 'Com cadastros atribuídos'
            : campaign.linkClicks > 0
              ? 'Tem tráfego, sem cadastro/compra atribuído ao Pixel'
              : campaign.spend > 0
                ? 'Sem resultado claro, revisar'
                : 'Acompanhar',
      }))

    return NextResponse.json({
      configured: true,
      days,
      since,
      until,
      adAccounts: adAccountIds,
      ads: decoratedAds,
      campaigns,
      ignoredCount: ignoredAds.length,
      ignoredSpend: consideredIgnoredAds.reduce((sum, ad) => sum + ad.spend, 0),
      totals: {
        spend: decoratedAds.reduce((sum, ad) => sum + ad.spend, 0),
        clicks: decoratedAds.reduce((sum, ad) => sum + ad.clicks, 0),
        linkClicks: decoratedAds.reduce((sum, ad) => sum + ad.linkClicks, 0),
        impressions: decoratedAds.reduce((sum, ad) => sum + ad.impressions, 0),
        registrations: decoratedAds.reduce((sum, ad) => sum + ad.registrations, 0),
        purchases: decoratedAds.reduce((sum, ad) => sum + ad.purchases, 0),
        purchaseValue: decoratedAds.reduce((sum, ad) => sum + ad.purchaseValue, 0),
      },
      errors,
      checkedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[ADMIN ADS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao consultar Meta Ads', details: error.message },
      { status: 500 }
    )
  }
}
