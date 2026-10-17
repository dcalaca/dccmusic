import { describe, expect, it } from 'vitest'
import { createPaymentDayClassifier } from './payment-day-cohort'

describe('payment day cohorts', () => {
  it('keeps all ten first-day purchases new, then marks the next day returning', () => {
    const classify = createPaymentDayClassifier(new Set())
    for (let i = 0; i < 10; i++) expect(classify('a', '2026-10-17')).toBe('new')
    expect(classify('a', '2026-10-18')).toBe('recurring')
  })
  it('keeps buyers with a payment before the period returning', () => {
    const classify = createPaymentDayClassifier(new Set(['old']))
    expect(classify('old', '2026-10-17')).toBe('recurring')
    expect(classify('old', '2026-10-18')).toBe('recurring')
    expect(classify('first-buyer', '2026-10-18')).toBe('new')
  })
})
