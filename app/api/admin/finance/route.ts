import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { sendAdminStudioAlertEmail } from '@/lib/dcc-emails'
import { FREE_STUDIO_MUSIC_LIMIT } from '@/lib/studio'
import { getSunoCreditBalance, maybeSendSunoLowCreditAlert } from '@/lib/suno-credit-alert'

export const dynamic = 'force-dynamic'

const SUNO_CREDIT_COST_BRL = Number(process.env.SUNO_CREDIT_COST_BRL || '0.025')
const SUNO_MUSIC_GENERATION_CREDITS = Number(process.env.SUNO_MUSIC_GENERATION_CREDITS || '12')
const SUNO_LYRIC_VIDEO_CREDITS = Number(process.env.SUNO_LYRIC_VIDEO_CREDITS || '2')

// Taxa de conversão dólar -> real (ajustável via env USD_TO_BRL)
const USD_TO_BRL = Number(process.env.USD_TO_BRL || '5.40')

// Custos fixos mensais (informados em dólar), convertidos para real.
const SUPABASE_MONTHLY_USD = Number(process.env.SUPABASE_MONTHLY_COST_USD || '35')
const VERCEL_MONTHLY_USD = Number(process.env.VERCEL_MONTHLY_COST_USD || '20')
const RESEND_MONTHLY_USD = Number(process.env.RESEND_MONTHLY_COST_USD || '20')

const supabaseMonthlyFixedBrl = Number(process.env.SUPABASE_MONTHLY_FIXED_COST_BRL || '') || (SUPABASE_MONTHLY_USD * USD_TO_BRL)
const vercelMonthlyFixedBrl = Number(process.env.VERCEL_MONTHLY_FIXED_COST_BRL || '') || (VERCEL_MONTHLY_USD * USD_TO_BRL)
const resendMonthlyFixedBrl = Number(process.env.RESEND_MONTHLY_FIXED_COST_BRL || '') || (RESEND_MONTHLY_USD * USD_TO_BRL)

const COST_ASSUMPTIONS = {
  sunoCreditCostBrl: SUNO_CREDIT_COST_BRL,
  sunoMusicGenerationCredits: SUNO_MUSIC_GENERATION_CREDITS,
  sunoLyricVideoCredits: SUNO_LYRIC_VIDEO_CREDITS,
  sunoMaxCreditsPerCompleteMusic: SUNO_MUSIC_GENERATION_CREDITS + SUNO_LYRIC_VIDEO_CREDITS,
  musicGeneration: Number(process.env.SUNO_MUSIC_GENERATION_COST_BRL || '0.32'),
  lyricVideo: Number(process.env.SUNO_LYRIC_VIDEO_COST_BRL || (SUNO_LYRIC_VIDEO_CREDITS * SUNO_CREDIT_COST_BRL).toFixed(4)),
  simpleCover: Number(process.env.STUDIO_COST_SIMPLE_COVER_BRL || '0.06'),
  premiumCover: Number(process.env.STUDIO_COST_PREMIUM_COVER_BRL || '0.95'),
  lyricGeneration: Number(process.env.STUDIO_COST_LYRIC_GENERATION_BRL || '0.0015'),
  resendMonthlyFixed: resendMonthlyFixedBrl,
  resendPerEmail: Number(process.env.RESEND_COST_PER_EMAIL_BRL || '0') || (Number(process.env.RESEND_COST_PER_1000_EMAILS_BRL || '0') / 1000),
  vercelMonthlyFixed: vercelMonthlyFixedBrl,
  supabaseMonthlyFixed: supabaseMonthlyFixedBrl,
  mercadoPagoPixRate: Number(process.env.MERCADOPAGO_PIX_FEE_RATE || '0.01'),
  mercadoPagoCardRate: Number(process.env.MERCADOPAGO_CARD_FEE_RATE || '0.025'),
  openAiUsdToBrl: Number(process.env.OPENAI_USD_TO_BRL || '') || USD_TO_BRL,
  usdToBrl: USD_TO_BRL,
}

type PaymentDetail = {
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
}

type MetaAdsCampaign = {
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
}

// Campanhas/anúncios de divulgação de música que não devem entrar no custo por padrão.
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
      .map(value => value.trim())
      .filter(Boolean)
      .map(normalizeMetaAdAccountId)
  ))
}

function extractMetaRegistrations(actions: any[] | undefined) {
  if (!Array.isArray(actions)) return 0

  return actions.reduce((total, action) => {
    const type = String(action?.action_type || '').toLowerCase()
    const value = Number(action?.value) || 0

    if (
      type === 'complete_registration' ||
      type === 'offsite_conversion.fb_pixel_complete_registration' ||
      type.includes('complete_registration')
    ) {
      return total + value
    }

    return total
  }, 0)
}

function normalizeMetaName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function shouldConsiderMetaAd(row: {
  campaignName: string
  adName: string
}) {
  const name = normalizeMetaName(`${row.campaignName} ${row.adName}`)
  // Considera todas as campanhas por padrão; só ignora as explicitamente excluídas.
  return !META_ADS_EXCLUDE_PATTERNS.some(pattern => name.includes(pattern))
}

async function getMetaAdsSummary(startDate: Date, endDateExclusive: Date) {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountIds = getMetaAdAccountIds()

  if (!accessToken || adAccountIds.length === 0) {
    return {
      configured: false,
      currency: 'BRL',
      spend: 0,
      clicks: 0,
      impressions: 0,
      registrations: 0,
      campaigns: [] as MetaAdsCampaign[],
      adAccounts: [] as string[],
      error: 'META_ACCESS_TOKEN e META_AD_ACCOUNT_ID ou META_AD_ACCOUNT_IDS não configurados',
      checkedAt: new Date().toISOString(),
    }
  }

  try {
    const campaigns: MetaAdsCampaign[] = []
    const ignoredCampaigns: MetaAdsCampaign[] = []
    const accountErrors: string[] = []
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0'
    const since = startDate.toISOString().slice(0, 10)
    const until = addDays(endDateExclusive, -1).toISOString().slice(0, 10)

    for (const adAccountId of adAccountIds) {
      const params = new URLSearchParams({
        access_token: accessToken,
        level: 'ad',
        fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,clicks,impressions,cpc,actions',
        time_range: JSON.stringify({ since, until }),
        limit: '100',
      })

      let nextUrl: string | null = `https://graph.facebook.com/${apiVersion}/${adAccountId}/insights?${params.toString()}`

      while (nextUrl) {
        const currentUrl: string = nextUrl
        const response: Response = await fetch(currentUrl, { cache: 'no-store' })
        const payload: any = await response.json().catch(() => null)

        if (!response.ok || payload?.error) {
          accountErrors.push(`${adAccountId}: ${payload?.error?.message || 'não foi possível consultar'}`)
          break
        }

        const rows = Array.isArray(payload?.data) ? payload.data : []
        const mappedRows: MetaAdsCampaign[] = rows.map((row: any) => ({
          adAccountId,
          adId: row.ad_id || 'sem-id',
          adName: row.ad_name || 'Anúncio sem nome',
          campaignId: row.campaign_id || 'sem-id',
          campaignName: row.campaign_name || 'Campanha sem nome',
          spend: Number(row.spend) || 0,
          clicks: Number(row.clicks) || 0,
          impressions: Number(row.impressions) || 0,
          cpc: row.cpc != null ? Number(row.cpc) || 0 : null,
          registrations: extractMetaRegistrations(row.actions),
        }))

        campaigns.push(...mappedRows.filter(shouldConsiderMetaAd))
        ignoredCampaigns.push(...mappedRows.filter((row: MetaAdsCampaign) => !shouldConsiderMetaAd(row)))

        nextUrl = payload?.paging?.next || null
      }
    }

    const spend = campaigns.reduce((total, campaign) => total + campaign.spend, 0)
    const clicks = campaigns.reduce((total, campaign) => total + campaign.clicks, 0)
    const impressions = campaigns.reduce((total, campaign) => total + campaign.impressions, 0)
    const registrations = campaigns.reduce((total, campaign) => total + campaign.registrations, 0)
    const ignoredSpend = ignoredCampaigns.reduce((total, campaign) => total + campaign.spend, 0)

    return {
      configured: true,
      currency: 'BRL',
      spend,
      clicks,
      impressions,
      registrations,
      campaigns: campaigns.sort((a, b) => b.spend - a.spend),
      adAccounts: adAccountIds,
      ignoredSpend,
      ignoredCount: ignoredCampaigns.length,
      filterDescription: 'Todas as campanhas, exceto divulgação de música ignorada',
      error: accountErrors.length > 0 ? accountErrors.join(' | ') : null,
      checkedAt: new Date().toISOString(),
    }
  } catch (error: any) {
    return {
      configured: true,
      currency: 'BRL',
      spend: 0,
      clicks: 0,
      impressions: 0,
      registrations: 0,
      campaigns: [] as MetaAdsCampaign[],
      adAccounts: adAccountIds,
      error: error.message || 'Erro ao consultar gastos da Meta Ads',
      checkedAt: new Date().toISOString(),
    }
  }
}

function sumOpenAiCosts(payload: any) {
  const buckets = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []

  return buckets.reduce((total: number, bucket: any) => {
    const results = Array.isArray(bucket?.results) ? bucket.results : []
    return total + results.reduce((sum: number, result: any) => {
      return sum + (Number(result?.amount?.value) || 0)
    }, 0)
  }, 0)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getOpenAiCostErrorMessage(response: Response, payload: any) {
  const rawMessage = payload?.error?.message || ''
  if (response.status === 429 || String(rawMessage).toLowerCase().includes('rate limit')) {
    return 'Consulta da OpenAI limitada temporariamente. Tente atualizar novamente em instantes.'
  }

  return rawMessage || 'Não foi possível consultar custos da IA criativa'
}

async function getOpenAiCostSummary(startDate: Date, endDate: Date, delayMs = 0) {
  const apiKey = process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      configured: false,
      costUsd: null,
      currency: 'usd',
      error: 'API criativa não configurada',
      checkedAt: new Date().toISOString(),
    }
  }

  try {
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const params = new URLSearchParams({
      start_time: String(Math.floor(startDate.getTime() / 1000)),
      end_time: String(Math.floor(endDate.getTime() / 1000)),
      bucket_width: '1d',
    })

    const response = await fetch(`https://api.openai.com/v1/organization/costs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        configured: true,
        costUsd: null,
        currency: 'usd',
        error: getOpenAiCostErrorMessage(response, payload),
        checkedAt: new Date().toISOString(),
      }
    }

    return {
      configured: true,
      costUsd: sumOpenAiCosts(payload),
      currency: 'usd',
      error: null,
      checkedAt: new Date().toISOString(),
    }
  } catch (error: any) {
    return {
      configured: true,
      costUsd: null,
      currency: 'usd',
      error: error.message || 'Erro ao consultar custos da IA criativa',
      checkedAt: new Date().toISOString(),
    }
  }
}

async function maybeSendOpenAiBudgetAlert(monthCost: Awaited<ReturnType<typeof getOpenAiCostSummary>>) {
  const budgetUsd = Number(process.env.OPENAI_MONTHLY_BUDGET_USD || '0')
  const thresholdPercent = Number(process.env.OPENAI_ALERT_THRESHOLD_PERCENT || '80')

  if (!monthCost.configured || monthCost.error || monthCost.costUsd == null || budgetUsd <= 0) return

  const usedPercent = (monthCost.costUsd / budgetUsd) * 100
  if (usedPercent < thresholdPercent) return

  const monthKey = new Date().toISOString().slice(0, 7)
  await sendAdminStudioAlertEmail({
    title: 'Alerta de gasto da IA criativa',
    message: `O gasto da IA criativa deste mês chegou a US$ ${monthCost.costUsd.toFixed(2)} de um limite configurado de US$ ${budgetUsd.toFixed(2)} (${usedPercent.toFixed(1)}%).`,
    eventKey: `openai-budget-alert/${monthKey}/${thresholdPercent}`,
    metadata: {
      monthKey,
      costUsd: monthCost.costUsd,
      budgetUsd,
      thresholdPercent,
      usedPercent,
    },
  }).catch((error) => {
    console.error('[Admin Finance] Erro ao enviar alerta de IA criativa:', error)
  })
}

function parseDateOnly(value: string | null, fallback: Date) {
  if (!value) return fallback
  // Datas do painel financeiro são escolhidas pelo admin em horário de Brasília.
  // O banco guarda timestamptz em UTC, então 00:00 BRT equivale a 03:00 UTC.
  const parsed = new Date(`${value}T00:00:00-03:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getPeriodDayCount(startDate: Date, endDateExclusive: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.max(1, Math.ceil((endDateExclusive.getTime() - startDate.getTime()) / millisecondsPerDay))
}

function getDefaultRange() {
  const now = new Date()
  const saoPauloDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [year, month] = saoPauloDate.split('-')

  return {
    start: parseDateOnly(`${year}-${month}-01`, now),
    end: parseDateOnly(saoPauloDate, now),
  }
}

function sumAmount(rows: any[] | null | undefined) {
  return (rows || []).reduce((total, row) => total + Math.max(0, Number(row.amount) || 0), 0)
}

function getPaymentMethodFromPayload(payload: any) {
  return payload?.payment_method_id ||
    payload?.payment_method?.id ||
    payload?.payment_type_id ||
    payload?.payment_type ||
    null
}

function normalizePaymentMethod(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function getMercadoPagoFeeRate(paymentMethod?: string | null) {
  const method = normalizePaymentMethod(paymentMethod)
  if (method.includes('pix')) return COST_ASSUMPTIONS.mercadoPagoPixRate
  return COST_ASSUMPTIONS.mercadoPagoCardRate
}

function getMercadoPagoFeeType(paymentMethod?: string | null) {
  const method = normalizePaymentMethod(paymentMethod)
  return method.includes('pix') ? 'pix' : 'card'
}

function estimateMercadoPagoFee(amount: number, paymentMethod?: string | null) {
  return Math.max(0, Number(amount) || 0) * getMercadoPagoFeeRate(paymentMethod)
}

function buildMercadoPagoFeeSummary(paymentDetails: PaymentDetail[]) {
  const summary = {
    pixAmount: 0,
    pixFees: 0,
    pixCount: 0,
    cardAmount: 0,
    cardFees: 0,
    cardCount: 0,
    totalAmount: 0,
    totalFees: 0,
  }

  for (const payment of paymentDetails) {
    const amount = Math.max(0, Number(payment.amount) || 0)
    const fee = Math.max(0, Number(payment.mercadoPagoFee) || 0)
    summary.totalAmount += amount
    summary.totalFees += fee

    if (getMercadoPagoFeeType(payment.paymentMethod) === 'pix') {
      summary.pixAmount += amount
      summary.pixFees += fee
      summary.pixCount += 1
    } else {
      summary.cardAmount += amount
      summary.cardFees += fee
      summary.cardCount += 1
    }
  }

  return {
    ...summary,
    pixRate: COST_ASSUMPTIONS.mercadoPagoPixRate,
    cardRate: COST_ASSUMPTIONS.mercadoPagoCardRate,
    effectiveRate: summary.totalAmount > 0 ? summary.totalFees / summary.totalAmount : 0,
  }
}

function buildEmailCategoryBreakdown(rows: any[] | null | undefined) {
  const byCategory = new Map<string, number>()

  for (const row of rows || []) {
    const category = row.category || 'sem_categoria'
    byCategory.set(category, (byCategory.get(category) || 0) + 1)
  }

  return Array.from(byCategory.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

function isMissingTableError(error: any, tableName: string) {
  const message = String(error?.message || '').toLowerCase()
  return Boolean(error && (message.includes(tableName.toLowerCase()) || message.includes('schema cache')))
}

function toSaoPauloDayKey(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function buildDailySalesSeries(paymentDetails: PaymentDetail[], startDate: Date, endDateExclusive: Date) {
  const buckets = new Map<string, { date: string; amount: number; count: number }>()
  let current = new Date(startDate)

  while (current < endDateExclusive) {
    const key = toSaoPauloDayKey(current.toISOString())
    if (key) buckets.set(key, { date: key, amount: 0, count: 0 })
    current = addDays(current, 1)
  }

  for (const payment of paymentDetails) {
    const key = toSaoPauloDayKey(payment.paidAt)
    const bucket = key ? buckets.get(key) : null
    if (!bucket) continue
    bucket.amount += Math.max(0, Number(payment.amount) || 0)
    bucket.count += 1
  }

  return Array.from(buckets.values())
}

function dedupeByKey<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = getKey(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mapById(rows: any[] | null | undefined) {
  return new Map((rows || []).map(row => [row.id, row]))
}

function isMissingTopupTableError(error: any) {
  return Boolean(error && String(error.message || '').includes('studio_credit_topups'))
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const defaultRange = getDefaultRange()
    const startDate = parseDateOnly(searchParams.get('startDate'), defaultRange.start)
    const endDate = parseDateOnly(searchParams.get('endDate'), defaultRange.end)
    const endExclusive = addDays(endDate, 1)

    const startIso = startDate.toISOString()
    const endIso = endExclusive.toISOString()
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const monthEnd = addDays(new Date(), 1)

    const [
      paymentsResult,
      featuredPaymentsResult,
      studioTopupsResult,
      videoPaymentsResult,
      generationsResult,
      generationTransactionsResult,
      lyricVideosResult,
      premiumCoversResult,
      simpleCoversResult,
      lyricsResult,
      emailEventsResult,
      campaignEmailDeliveriesResult,
      realRegistrationsResult,
      sunoCreditBalance,
      openAiPeriodCost,
      openAiMonthCost,
      metaAdsSummary,
    ] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_payments')
        .select('id, composer_id, subscription_id, amount, payment_method, gateway_payment_id, gateway_response, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('id, composer_id, content_type, content_id, amount, created_at')
        .eq('payment_status', 'approved')
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_credit_topups')
        .select('id, composer_id, package_slug, music_quantity, credits, amount, payment_id, metadata, paid_at, created_at')
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('studio_video_requests')
        .select('id, composer_id, project_id, amount, payment_id, metadata, paid_at, created_at')
        .gt('amount', 0)
        .not('paid_at', 'is', null)
        .gte('paid_at', startIso)
        .lt('paid_at', endIso),
      supabaseAdmin
        .from('studio_generations')
        .select('id, composer_id, provider_task_id, status, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_credit_transactions')
        .select('id, composer_id, project_id, action, amount, metadata, created_at')
        .in('action', ['music_generation', 'free_music_generation'])
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_video_requests')
        .select('id, provider_task_id, created_at')
        .not('provider_task_id', 'is', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_credit_transactions')
        .select('id, action, created_at')
        .eq('action', 'premium_cover')
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_covers')
        .select('id, provider, is_premium, created_at')
        .eq('provider', 'openai')
        .eq('is_premium', false)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('studio_lyrics')
        .select('id, prompt, created_at')
        .not('prompt', 'is', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      supabaseAdmin
        .from('dccmusic_email_events')
        .select('id, event_key, category, recipient, sent_at, created_at')
        .gte('sent_at', startIso)
        .lt('sent_at', endIso),
      supabaseAdmin
        .from('admin_email_campaign_deliveries')
        .select('id, campaign_id, recipient_email, status, sent_at, created_at')
        .eq('status', 'sent')
        .gte('sent_at', startIso)
        .lt('sent_at', endIso),
      supabaseAdmin
        .from('dccmusic_composers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startIso)
        .lt('created_at', endIso),
      getSunoCreditBalance(),
      getOpenAiCostSummary(startDate, endExclusive),
      getOpenAiCostSummary(monthStart, monthEnd, 900),
      getMetaAdsSummary(startDate, endExclusive),
    ])

    await Promise.all([
      maybeSendOpenAiBudgetAlert(openAiMonthCost),
      maybeSendSunoLowCreditAlert(sunoCreditBalance),
    ])

    const topupTableMissing = isMissingTopupTableError(studioTopupsResult.error)
    const studioTopups = topupTableMissing ? [] : (studioTopupsResult.data || [])
    const subscriptionPayments = dedupeByKey(paymentsResult.data || [], (payment: any) => (
      payment.gateway_payment_id
        ? `gateway:${payment.gateway_payment_id}`
        : `subscription:${payment.subscription_id || payment.composer_id}:${Number(payment.amount) || 0}:${payment.paid_at || payment.created_at || ''}`
    ))
    const featuredPayments = dedupeByKey(featuredPaymentsResult.data || [], (payment: any) => (
      `featured:${payment.composer_id}:${payment.content_type}:${payment.content_id}:${Number(payment.amount) || 0}:${payment.created_at || ''}`
    ))
    const paidStudioTopups = dedupeByKey(studioTopups, (topup: any) => (
      `topup:${topup.id || topup.payment_id || topup.payment_preference_id}:${Number(topup.amount) || 0}`
    ))
    const paidVideoRequests = dedupeByKey(videoPaymentsResult.data || [], (payment: any) => (
      `video:${payment.id || payment.payment_id || payment.project_id}:${Number(payment.amount) || 0}:${payment.paid_at || payment.created_at || ''}`
    ))

    const campaignEmailTableMissing = isMissingTableError(campaignEmailDeliveriesResult.error, 'admin_email_campaign_deliveries')
    const errors = [
      paymentsResult.error,
      featuredPaymentsResult.error,
      topupTableMissing ? null : studioTopupsResult.error,
      videoPaymentsResult.error,
      generationsResult.error,
      generationTransactionsResult.error,
      lyricVideosResult.error,
      premiumCoversResult.error,
      simpleCoversResult.error,
      lyricsResult.error,
      emailEventsResult.error,
      campaignEmailTableMissing ? null : campaignEmailDeliveriesResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error('[Admin Finance] Erro ao calcular painel:', errors)
      return NextResponse.json(
        { error: 'Erro ao calcular painel financeiro', details: errors.map((error: any) => error.message).join(' | ') },
        { status: 500 }
      )
    }

    const composerIds = Array.from(new Set([
      ...subscriptionPayments.map((row: any) => row.composer_id),
      ...featuredPayments.map((row: any) => row.composer_id),
      ...paidStudioTopups.map((row: any) => row.composer_id),
      ...paidVideoRequests.map((row: any) => row.composer_id),
    ].filter(Boolean)))

    const composersResult = await (
      composerIds.length > 0
        ? supabaseAdmin
            .from('dccmusic_composers')
            .select('id, name, email')
            .in('id', composerIds)
        : Promise.resolve({ data: [], error: null })
    )

    if (composersResult.error) {
      console.error('[Admin Finance] Erro ao buscar detalhes de pagadores:', composersResult.error)
      return NextResponse.json(
        { error: 'Erro ao buscar detalhes dos pagamentos' },
        { status: 500 }
      )
    }

    const composersById = mapById(composersResult.data)

    const paymentDetails: PaymentDetail[] = [
      ...subscriptionPayments.map((payment: any) => {
        const composer = composersById.get(payment.composer_id)
        const paymentMethod = payment.payment_method || getPaymentMethodFromPayload(payment.gateway_response)
        const amount = Number(payment.amount) || 0
        return {
          id: payment.id,
          source: 'subscription' as const,
          label: 'Assinatura',
          amount,
          paidAt: payment.paid_at || payment.created_at || null,
          customerName: composer?.name || 'Compositor sem nome',
          customerEmail: composer?.email || 'E-mail não informado',
          description: 'Pagamento de plano',
          paymentMethod,
          mercadoPagoFee: estimateMercadoPagoFee(amount, paymentMethod),
        }
      }),
      ...featuredPayments.map((payment: any) => {
        const composer = composersById.get(payment.composer_id)
        const paymentMethod = null
        const amount = Number(payment.amount) || 0
        return {
          id: payment.id,
          source: 'featured' as const,
          label: 'Destaque',
          amount,
          paidAt: payment.created_at || null,
          customerName: composer?.name || 'Compositor sem nome',
          customerEmail: composer?.email || 'E-mail não informado',
          description: payment.content_type === 'video' ? 'Destaque de vídeo' : 'Destaque de música',
          paymentMethod,
          mercadoPagoFee: estimateMercadoPagoFee(amount, paymentMethod),
        }
      }),
      ...paidStudioTopups.map((payment: any) => {
        const composer = composersById.get(payment.composer_id)
        const paymentMethod = getPaymentMethodFromPayload(payment.metadata?.mercadopago_payment)
        const amount = Number(payment.amount) || 0
        return {
          id: payment.id,
          source: 'studio_topup' as const,
          label: 'Recarga Studio',
          amount,
          paidAt: payment.paid_at || payment.created_at || null,
          customerName: composer?.name || 'Compositor sem nome',
          customerEmail: composer?.email || 'E-mail não informado',
          description: `Recarga avulsa: ${payment.music_quantity} músicas (${payment.credits} créditos)`,
          paymentMethod,
          mercadoPagoFee: estimateMercadoPagoFee(amount, paymentMethod),
        }
      }),
      ...paidVideoRequests.map((payment: any) => {
        const composer = composersById.get(payment.composer_id)
        const paymentMethod = getPaymentMethodFromPayload(payment.metadata)
        const amount = Number(payment.amount) || 0
        return {
          id: payment.id,
          source: 'video' as const,
          label: 'Vídeo',
          amount,
          paidAt: payment.paid_at || payment.created_at || null,
          customerName: composer?.name || 'Compositor sem nome',
          customerEmail: composer?.email || 'E-mail não informado',
          description: 'Vídeo com letra',
          paymentMethod,
          mercadoPagoFee: estimateMercadoPagoFee(amount, paymentMethod),
        }
      }),
    ].sort((a, b) => {
      const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0
      const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0
      return dateB - dateA
    })

    const subscriptionRevenue = sumAmount(subscriptionPayments)
    const featuredRevenue = sumAmount(featuredPayments)
    const studioTopupRevenue = sumAmount(paidStudioTopups)
    const videoRevenue = sumAmount(paidVideoRequests)
    const totalRevenue = subscriptionRevenue + featuredRevenue + studioTopupRevenue + videoRevenue
    const mercadoPagoFees = buildMercadoPagoFeeSummary(paymentDetails)
    const averageTicket = paymentDetails.length > 0 ? totalRevenue / paymentDetails.length : 0
    const salesSeries = buildDailySalesSeries(paymentDetails, startDate, endExclusive)

    const successfulGenerationRows = (generationsResult.data || []).filter((generation: any) => generation.status !== 'failed')
    const failedGenerationTaskIds = new Set(
      (generationsResult.data || [])
        .filter((generation: any) => generation.status === 'failed' && generation.provider_task_id)
        .map((generation: any) => generation.provider_task_id)
    )
    const generationTransactions = (generationTransactionsResult.data || []).filter((transaction: any) => (
      !failedGenerationTaskIds.has(transaction.metadata?.taskId)
    ))
    const trackedPaidMusicGenerations = generationTransactions.filter((transaction: any) => transaction.action === 'music_generation').length
    const trackedFreeMusicGenerations = generationTransactions.filter((transaction: any) => transaction.action === 'free_music_generation').length
    const musicGenerations = successfulGenerationRows.length
    const trackedMusicGenerations = trackedPaidMusicGenerations + trackedFreeMusicGenerations
    const untrackedMusicGenerations = Math.max(0, musicGenerations - trackedMusicGenerations)
    const freeSlotsNotTracked = Math.max(0, FREE_STUDIO_MUSIC_LIMIT - trackedFreeMusicGenerations)
    const untrackedFreeMusicGenerations = Math.min(untrackedMusicGenerations, freeSlotsNotTracked)
    const untrackedPaidMusicGenerations = Math.max(0, untrackedMusicGenerations - untrackedFreeMusicGenerations)
    const paidMusicGenerations = trackedPaidMusicGenerations + untrackedPaidMusicGenerations
    const freeMusicGenerations = trackedFreeMusicGenerations + untrackedFreeMusicGenerations
    const paidMusicCost = paidMusicGenerations * COST_ASSUMPTIONS.musicGeneration
    const freeMusicCost = freeMusicGenerations * COST_ASSUMPTIONS.musicGeneration
    const lyricVideos = lyricVideosResult.data?.length || 0
    const premiumCovers = premiumCoversResult.data?.length || 0
    const simpleCovers = simpleCoversResult.data?.length || 0
    const lyricGenerations = lyricsResult.data?.length || 0
    const transactionalEmailRows = (emailEventsResult.data || []).filter((row: any) => row.category !== 'admin_email_campaign')
    const campaignEmailDeliveries = campaignEmailTableMissing ? [] : (campaignEmailDeliveriesResult.data || [])
    const campaignEmailRows = campaignEmailDeliveries.map((delivery: any) => ({
      id: delivery.id,
      category: 'admin_email_campaign',
      recipient: delivery.recipient_email,
      sent_at: delivery.sent_at || delivery.created_at,
    }))
    const emailRowsForFinance = [...transactionalEmailRows, ...campaignEmailRows]
    const sentEmails = emailRowsForFinance.length
    const realRegistrationsInPeriod = realRegistrationsResult?.count || 0
    const periodDayCount = getPeriodDayCount(startDate, endExclusive)
    const proratedResendFixedCost = (COST_ASSUMPTIONS.resendMonthlyFixed / 30.44) * periodDayCount
    const proratedVercelFixedCost = (COST_ASSUMPTIONS.vercelMonthlyFixed / 30.44) * periodDayCount
    const proratedSupabaseFixedCost = (COST_ASSUMPTIONS.supabaseMonthlyFixed / 30.44) * periodDayCount
    const estimatedLyricCost = lyricGenerations * COST_ASSUMPTIONS.lyricGeneration
    const estimatedSimpleCoverCost = simpleCovers * COST_ASSUMPTIONS.simpleCover
    const estimatedPremiumCoverCost = premiumCovers * COST_ASSUMPTIONS.premiumCover
    const estimatedOpenAiCost = estimatedLyricCost + estimatedSimpleCoverCost + estimatedPremiumCoverCost
    const openAiActualCostBrl = openAiPeriodCost.costUsd != null && COST_ASSUMPTIONS.openAiUsdToBrl > 0
      ? openAiPeriodCost.costUsd * COST_ASSUMPTIONS.openAiUsdToBrl
      : null

    const costs = {
      music: paidMusicCost + freeMusicCost,
      sunoPaidMusic: paidMusicCost,
      sunoFreeMusic: freeMusicCost,
      sunoLyricVideos: lyricVideos * COST_ASSUMPTIONS.lyricVideo,
      lyricVideos: lyricVideos * COST_ASSUMPTIONS.lyricVideo,
      simpleCovers: estimatedSimpleCoverCost,
      premiumCovers: estimatedPremiumCoverCost,
      lyrics: estimatedLyricCost,
      metaAds: metaAdsSummary.spend,
      mercadoPagoFees: mercadoPagoFees.totalFees,
      resendEmails: (sentEmails * COST_ASSUMPTIONS.resendPerEmail) + proratedResendFixedCost,
      vercelHosting: proratedVercelFixedCost,
      supabaseHosting: proratedSupabaseFixedCost,
      suno: paidMusicCost + freeMusicCost + (lyricVideos * COST_ASSUMPTIONS.lyricVideo),
      openAi: openAiActualCostBrl ?? estimatedOpenAiCost,
    }
    const fixedCosts = {
      supabase: costs.supabaseHosting,
      vercel: costs.vercelHosting,
      resend: costs.resendEmails,
      total: costs.supabaseHosting + costs.vercelHosting + costs.resendEmails,
    }
    const variableCosts = {
      metaAds: costs.metaAds,
      mercadoPagoFees: costs.mercadoPagoFees,
      suno: costs.suno,
      openAi: costs.openAi,
      total: costs.metaAds + costs.mercadoPagoFees + costs.suno + costs.openAi,
    }
    const totalCost = fixedCosts.total + variableCosts.total
    const estimatedProfit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      },
      revenue: {
        subscriptions: subscriptionRevenue,
        featured: featuredRevenue,
        studioTopups: studioTopupRevenue,
        videos: videoRevenue,
        total: totalRevenue,
      },
      costs: {
        ...costs,
        fixed: fixedCosts,
        variable: variableCosts,
        total: totalCost,
      },
      profit: {
        estimated: estimatedProfit,
        margin,
      },
      counts: {
        subscriptionPayments: subscriptionPayments.length,
        featuredPayments: featuredPayments.length,
        studioTopupPayments: paidStudioTopups.length,
        paidVideoRequests: paidVideoRequests.length,
        musicGenerations,
        paidMusicGenerations,
        freeMusicGenerations,
        untrackedMusicGenerations,
        lyricVideos,
        simpleCovers,
        premiumCovers,
        lyricGenerations,
        metaAdCampaigns: metaAdsSummary.campaigns.length,
        metaAdClicks: metaAdsSummary.clicks,
        metaAdImpressions: metaAdsSummary.impressions,
        metaAdRegistrations: metaAdsSummary.registrations,
        realRegistrationsInPeriod,
        sentEmails,
      },
      sales: {
        averageTicket,
        totalQuantity: paymentDetails.length,
        series: salesSeries,
      },
      paymentDetails,
      costAssumptions: COST_ASSUMPTIONS,
      externalBalances: {
        suno: sunoCreditBalance,
        openai: {
          ...openAiPeriodCost,
          monthCostUsd: openAiMonthCost.costUsd,
          monthlyBudgetUsd: Number(process.env.OPENAI_MONTHLY_BUDGET_USD || '0') || null,
          alertThresholdPercent: Number(process.env.OPENAI_ALERT_THRESHOLD_PERCENT || '80'),
        },
        metaAds: metaAdsSummary,
        mercadoPago: {
          configured: true,
          estimatedCost: costs.mercadoPagoFees,
          ...mercadoPagoFees,
          checkedAt: new Date().toISOString(),
        },
        resend: {
          configured: Boolean(process.env.RESEND_API_KEY),
          sentEmails,
          transactionalEmails: transactionalEmailRows.length,
          campaignEmails: campaignEmailRows.length,
          variableCost: sentEmails * COST_ASSUMPTIONS.resendPerEmail,
          fixedCost: proratedResendFixedCost,
          estimatedCost: costs.resendEmails,
          categories: buildEmailCategoryBreakdown(emailRowsForFinance),
          error: null,
          checkedAt: new Date().toISOString(),
        },
        vercel: {
          configured: true,
          monthlyFixedCost: COST_ASSUMPTIONS.vercelMonthlyFixed,
          fixedCost: proratedVercelFixedCost,
          estimatedCost: costs.vercelHosting,
          periodDayCount,
          checkedAt: new Date().toISOString(),
        },
        supabase: {
          configured: true,
          monthlyFixedCost: COST_ASSUMPTIONS.supabaseMonthlyFixed,
          fixedCost: proratedSupabaseFixedCost,
          estimatedCost: costs.supabaseHosting,
          periodDayCount,
          checkedAt: new Date().toISOString(),
        },
      },
    })
  } catch (error: any) {
    console.error('[Admin Finance] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar painel financeiro', details: error.message },
      { status: 500 }
    )
  }
}
