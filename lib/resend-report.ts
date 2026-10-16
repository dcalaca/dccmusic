export const REPORT_TIMEZONE = 'America/Sao_Paulo'
export type ReportPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'
export const REPORT_PRESETS: Record<ReportPreset, string> = {
  today: 'Hoje', yesterday: 'Ontem', last7: 'Últimos 7', last30: 'Últimos 30',
  thisMonth: 'Mês atual', lastMonth: 'Mês anterior', custom: 'Personalizado',
}
export type ReportRange = { startDate: string; endDate: string }
export const REPORT_METRICS = ['sent', 'delivered', 'bounced', 'complained', 'opened', 'unique_opened', 'clicked', 'unique_clicked', 'failed', 'suppressed', 'delivery_delayed', 'unsubscribed'] as const
export type MetricName = typeof REPORT_METRICS[number]
export type EmailMetrics = Record<MetricName, number>
export type CategoryMetrics = { category: string; label: string; metrics: EmailMetrics }
export type ResendReport = {
  range: ReportRange
  actualRange: { start: string; end: string }
  totals: EmailMetrics
  categories: CategoryMetrics[]
  meta: { checkedAt: string; source: string; warnings: string[]; emailCount: number; classifiedCount: number; retentionLimited: boolean }
}
export function saoPauloDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
function shiftDay(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
export function reportPresetRange(preset: ReportPreset, now = new Date()): ReportRange {
  const today = saoPauloDate(now)
  if (preset === 'yesterday') { const yesterday = shiftDay(today, -1); return { startDate: yesterday, endDate: yesterday } }
  if (preset === 'today') return { startDate: today, endDate: today }
  if (preset === 'last7' || preset === 'last30') return { startDate: shiftDay(today, preset === 'last7' ? -6 : -29), endDate: today }
  if (preset === 'lastMonth') {
    const last = shiftDay(`${today.slice(0, 7)}-01`, -1)
    return { startDate: `${last.slice(0, 7)}-01`, endDate: last }
  }
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today }
}
export function validateReportRange(range: ReportRange, now = new Date()) {
  for (const value of [range.startDate, range.endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Informe datas válidas.')
  }
  if (range.startDate > range.endDate) throw new Error('A data inicial deve ser anterior ou igual à final.')
  if (range.startDate > saoPauloDate(now)) throw new Error('A data inicial não pode estar no futuro.')
  if (Date.parse(range.endDate) - Date.parse(range.startDate) > 366 * 86400000) throw new Error('Consulte até 366 dias por vez.')
  return {
    start: new Date(`${range.startDate}T00:00:00-03:00`).toISOString(),
    end: new Date(Math.min(new Date(`${range.endDate}T23:59:59.999-03:00`).getTime(), now.getTime())).toISOString(),
  }
}
export function normalizeMetrics(input: unknown): EmailMetrics {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return Object.fromEntries(REPORT_METRICS.map(key => [key, typeof source[key] === 'number' && Number.isFinite(source[key]) ? Math.max(0, source[key] as number) : 0])) as EmailMetrics
}
const CATEGORY_LABELS: Record<string, string> = {
  composer_email_verification: 'Confirmação de email', composer_activation_reminder: 'Lembrete de ativação', composer_welcome: 'Boas-vindas',
  admin_new_composer: 'Aviso de novo cadastro', admin_composer_message: 'Mensagem ao compositor', admin_email_campaign: 'Campanhas para cadastrados',
  prospect_campaign: 'Prospecção / lista importada', manual_studio_credit: 'Crédito manual', low_studio_credits: 'Créditos baixos',
  studio_music_failure: 'Falha na criação de música', studio_music_ready: 'Música pronta', studio_music_comment: 'Comentário em música',
  payment_confirmation: 'Confirmação de pagamento', admin_payment_notification: 'Aviso de pagamento ao admin', admin_studio_alert: 'Alerta do Studio',
  subscription_expiration_reminder: 'Vencimento de assinatura', partner_welcome: 'Boas-vindas ao parceiro', composer_account_deleted: 'Exclusão de conta',
  composer_password_reset: 'Recuperação de senha', unclassified: 'Outros / sem tipo identificado',
}
export function categoryLabel(category: string) { return CATEGORY_LABELS[category] || category.replace(/_/g, ' ') }
export function groupResendMetrics(rows: Array<Record<string, unknown>>, categories: Map<string, string>) {
  const groups = new Map<string, CategoryMetrics>()
  let classifiedCount = 0
  for (const row of rows) {
    const id = String(row.email_id || '')
    const category = categories.get(id) || 'unclassified'
    if (category !== 'unclassified') classifiedCount++
    const item = groups.get(category) || { category, label: categoryLabel(category), metrics: normalizeMetrics({}) }
    const metrics = normalizeMetrics(row)
    for (const key of REPORT_METRICS) item.metrics[key] += metrics[key]
    groups.set(category, item)
  }
  return { categories: [...groups.values()].sort((a, b) => b.metrics.sent - a.metrics.sent || a.label.localeCompare(b.label)), classifiedCount }
}
