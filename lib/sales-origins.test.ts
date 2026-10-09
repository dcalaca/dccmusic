import { describe, expect, it } from 'vitest'
import { OriginSale, salesOrigin, summarizeOrigins } from './sales-origins'

describe('sales attribution', () => {
  it('keeps missing attribution distinct from recorded direct visits', () => {
    expect(salesOrigin(null)).toBe('Não identificada')
    expect(salesOrigin('direct')).toBe('Acesso direto')
  })
  it('groups equivalent sources while distinguishing Gmail from Google search', () => {
    expect(salesOrigin('ig')).toBe(salesOrigin('instagram.com'))
    expect(salesOrigin('com.google.android.gm')).toBe('E-mail')
    expect(salesOrigin('com.google.android.googlequicksearchbox')).toBe('Google')
    expect(salesOrigin(null, { msclkid: 'click' })).toBe('Bing')
    expect(salesOrigin('email', { gclid: 'older-click' })).toBe('E-mail')
  })
  it('counts purchases without mixing currencies', () => {
    const rows = [{ origin: 'Google', currency: 'BRL', amount: 10 }, { origin: 'Google', currency: 'USD', amount: 5 }, { origin: 'Google', currency: 'BRL', amount: 20 }] as OriginSale[]
    expect(summarizeOrigins(rows)).toEqual([{ origin: 'Google', count: 3, amounts: { BRL: 30, USD: 5 } }])
  })
})
