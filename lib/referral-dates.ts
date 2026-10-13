export type ReferralPeriod = 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'previousMonth' | 'custom'
export const REFERRAL_PAGE_SIZE = 10

export function saoPauloDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function shift(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function referralDateRange(period: Exclude<ReferralPeriod, 'custom'>, now = new Date()) {
  const today = saoPauloDate(now)
  const first = `${today.slice(0, 7)}-01`
  if (period === 'today') return { start: today, end: today }
  if (period === 'yesterday') return { start: shift(today, -1), end: shift(today, -1) }
  if (period === 'last7') return { start: shift(today, -6), end: today }
  if (period === 'last30') return { start: shift(today, -29), end: today }
  if (period === 'previousMonth') {
    const end = shift(first, -1)
    return { start: `${end.slice(0, 7)}-01`, end }
  }
  return { start: first, end: today }
}
export function referralBounds(start: string, end: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(start) || !valid(end) || start > end) throw new Error('invalid_dates')
  return { from: `${start}T00:00:00-03:00`, to: `${shift(end, 1)}T00:00:00-03:00` }
}
