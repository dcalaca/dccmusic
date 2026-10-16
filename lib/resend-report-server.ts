import 'server-only'
import { supabaseAdmin } from './supabase'
import { REPORT_TIMEZONE, REPORT_METRICS, ReportRange, ResendReport, groupResendMetrics, normalizeMetrics, validateReportRange } from './resend-report'

// Deduplicate requests and briefly cache aggregates; never send credentials or recipient data to the browser.
const cache = new Map<string, { expires: number; result: Promise<ResendReport> }>()
export function getResendReport(range: ReportRange): Promise<ResendReport> {
  const bounds = validateReportRange(range)
  const key = `${range.startDate}/${range.endDate}`
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.result
  const result = buildReport(range, bounds).catch(error => { cache.delete(key); throw error })
  if (cache.size >= 10) cache.delete(cache.keys().next().value!)
  cache.set(key, { expires: Date.now() + 60000, result })
  return result
}
async function buildReport(range: ReportRange, bounds: { start: string; end: string }): Promise<ResendReport> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada no servidor.')
  const params = new URLSearchParams({ start_date: bounds.start, end_date: bounds.end, timezone: REPORT_TIMEZONE, dimensions: 'email', metrics: REPORT_METRICS.join(',') })
  const response = await fetch(`https://api.resend.com/emails/metrics?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store', signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error('A RESEND_API_KEY existente não tem permissão para consultar métricas. Use uma chave com acesso de leitura / Full access.')
    if (response.status === 429) throw new Error('O Resend limitou as consultas. Aguarde um minuto e tente novamente.')
    throw new Error(`Não foi possível consultar as métricas no Resend (HTTP ${response.status}).`)
  }
  const payload = await response.json()
  if (!payload.totals || !Array.isArray(payload.data)) throw new Error('O Resend retornou um formato de relatório inesperado.')
  const rows = payload.data as Array<Record<string, unknown>>
  const ids = [...new Set(rows.map(row => String(row.email_id || '')).filter(Boolean))]
  const categories = new Map<string, string>()
  const warnings = new Set<string>()
  // Join by provider ID regardless of sent_at: an opening today can belong to an older email.
  // Bound each IN query and process several small chunks at a time for large reports.
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
  for (let i = 0; i < chunks.length; i += 4) {
    await Promise.all(chunks.slice(i, i + 4).map(async chunk => {
      const [transactional, campaigns, prospects] = await Promise.all([
        supabaseAdmin.from('dccmusic_email_events').select('provider_id,category').in('provider_id', chunk),
        supabaseAdmin.from('admin_email_campaign_deliveries').select('provider_message_id').in('provider_message_id', chunk),
        supabaseAdmin.from('prospect_deliveries').select('provider_id').in('provider_id', chunk),
      ])
      for (const [label, result] of [['transacionais', transactional], ['campanhas', campaigns], ['prospecção', prospects]] as const) {
        if (result.error) warnings.add(`Não foi possível identificar os tipos de ${label}; os valores do Resend continuam incluídos em Outros.`)
      }
      for (const row of transactional.data || []) if (row.provider_id) categories.set(row.provider_id, row.category || 'unclassified')
      for (const row of campaigns.data || []) if (row.provider_message_id) categories.set(row.provider_message_id, 'admin_email_campaign')
      for (const row of prospects.data || []) if (row.provider_id) categories.set(row.provider_id, 'prospect_campaign')
    }))
  }
  const grouped = groupResendMetrics(rows, categories)
  const actualStart = String(payload.start_date || bounds.start)
  const actualEnd = String(payload.end_date || bounds.end)
  return {
    range, actualRange: { start: actualStart, end: actualEnd }, totals: normalizeMetrics(payload.totals), categories: grouped.categories,
    meta: { checkedAt: new Date().toISOString(), source: 'Resend API · /emails/metrics', warnings: [...warnings], emailCount: ids.length, classifiedCount: grouped.classifiedCount, retentionLimited: new Date(actualStart).getTime() > new Date(bounds.start).getTime() + 1000 },
  }
}
