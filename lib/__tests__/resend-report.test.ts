import { describe, expect, it } from 'vitest'
import { reportPresetRange, saoPauloDate, validateReportRange, groupResendMetrics, normalizeMetrics } from '../resend-report'

describe('Resend report date boundaries', () => {
  const now = new Date('2026-10-16T22:32:27Z')
  it('uses São Paulo calendar days even when UTC is already tomorrow', () => {
    expect(saoPauloDate(new Date('2026-10-17T01:00:00Z'))).toBe('2026-10-16')
    expect(reportPresetRange('today', now)).toEqual({ startDate: '2026-10-16', endDate: '2026-10-16' })
    expect(reportPresetRange('yesterday', now)).toEqual({ startDate: '2026-10-15', endDate: '2026-10-15' })
  })
  it('includes today in the last 7 and 30 days', () => {
    expect(reportPresetRange('last7', now).startDate).toBe('2026-10-10')
    expect(reportPresetRange('last30', now).startDate).toBe('2026-09-17')
  })
  it('handles previous months across year and leap-year boundaries', () => {
    expect(reportPresetRange('lastMonth', new Date('2026-01-15T12:00:00Z'))).toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' })
    expect(reportPresetRange('lastMonth', new Date('2024-03-05T12:00:00Z')).endDate).toBe('2024-02-29')
  })
  it('uses complete days for past ranges and clamps today to now', () => {
    expect(validateReportRange(reportPresetRange('yesterday', now), now)).toEqual({ start: '2026-10-15T03:00:00.000Z', end: '2026-10-16T02:59:59.999Z' })
    expect(validateReportRange(reportPresetRange('today', now), now).end).toBe(now.toISOString())
  })
  it('rejects invalid, inverted, future, and excessively large ranges', () => {
    for (const range of [{ startDate: '2026-02-30', endDate: '2026-03-01' }, { startDate: '2026-10-16', endDate: '2026-10-15' }, { startDate: '2026-10-17', endDate: '2026-10-18' }, { startDate: '2024-01-01', endDate: '2026-01-01' }]) expect(() => validateReportRange(range, now)).toThrow()
  })
})
describe('Resend report grouping', () => {
  it('keeps unique opens separate from repeated events and preserves unknown emails', () => {
    const result = groupResendMetrics([
      { email_id: 'a', sent: 1, delivered: 1, unique_opened: 1, opened: 5, unique_clicked: 1, clicked: 3 },
      { email_id: 'b', sent: 1, delivered: 1, unique_opened: 1, opened: 2 },
      { email_id: 'old', sent: 0, unique_opened: 1, opened: 1 },
      { email_id: 'unknown', sent: 1, bounced: 1 },
    ], new Map([['a', 'studio_music_ready'], ['b', 'studio_music_ready'], ['old', 'composer_welcome']]))
    const ready = result.categories.find(row => row.category === 'studio_music_ready')!
    expect(ready.metrics.unique_opened).toBe(2); expect(ready.metrics.opened).toBe(7)
    expect(ready.metrics.clicked).toBe(3); expect(ready.metrics.unique_clicked).toBe(1)
    expect(result.categories.find(row => row.category === 'composer_welcome')!.metrics.sent).toBe(0)
    expect(result.categories.find(row => row.category === 'unclassified')!.metrics.bounced).toBe(1)
    expect(result.classifiedCount).toBe(3)
  })
  it('does not truncate large reports to the database default page size', () => {
    const result = groupResendMetrics(Array.from({ length: 2501 }, (_, i) => ({ email_id: `m${i}`, sent: 1 })), new Map())
    expect(result.categories[0].metrics.sent).toBe(2501)
  })
  it('normalizes absent and invalid metrics without inventing reading data', () => {
    const result = normalizeMetrics({ opened: NaN, bounced: -2, sent: 3 })
    expect(result.opened).toBe(0); expect(result.bounced).toBe(0); expect(result.sent).toBe(3)
    expect(result).not.toHaveProperty('read')
  })
})
