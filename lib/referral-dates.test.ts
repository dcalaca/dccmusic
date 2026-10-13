import { describe, expect, it } from 'vitest'
import { referralBounds, referralDateRange, saoPauloDate } from './referral-dates'

describe('referral dates in Brasília', () => {
  it('uses the previous local day before 03:00 UTC', () => {
    const now = new Date('2026-11-01T02:59:59Z')
    expect(saoPauloDate(now)).toBe('2026-10-31')
    expect(referralDateRange('month', now)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(referralDateRange('today', new Date('2026-11-01T03:00:00Z'))).toEqual({ start: '2026-11-01', end: '2026-11-01' })
  })
  it('includes today in 7-day and 30-day windows', () => {
    const now = new Date('2026-10-13T21:00:00Z')
    expect(referralDateRange('last7', now)).toEqual({ start: '2026-10-07', end: '2026-10-13' })
    expect(referralDateRange('last30', now)).toEqual({ start: '2026-09-14', end: '2026-10-13' })
    expect(referralDateRange('yesterday', now)).toEqual({ start: '2026-10-12', end: '2026-10-12' })
  })
  it('handles leap years and January year boundaries', () => {
    expect(referralDateRange('previousMonth', new Date('2024-03-15T12:00:00Z'))).toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(referralDateRange('previousMonth', new Date('2026-01-15T12:00:00Z'))).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })
  it('makes the final day inclusive with an exclusive next-day bound', () => {
    expect(referralBounds('2026-10-13', '2026-10-13')).toEqual({ from: '2026-10-13T00:00:00-03:00', to: '2026-10-14T00:00:00-03:00' })
  })
  it.each([['2026-02-30', '2026-03-01'], ['2026-10-14', '2026-10-13'], ['bad', '2026-10-13'], ['2026-10-13', '']])('rejects invalid custom dates %s %s', (start, end) => {
    expect(() => referralBounds(start, end)).toThrow('invalid_dates')
  })
})
