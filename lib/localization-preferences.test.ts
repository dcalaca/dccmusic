import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

describe('language and country preferences', () => {
  it('changes the interface language without changing the pricing country', () => {
    const request = new NextRequest('https://www.dccmusic.online/planos', {
      headers: { host: 'www.dccmusic.online', 'x-vercel-ip-country': 'ES', cookie: 'dcc_country=ES; dcc_locale=pt-BR' },
    })
    const response = middleware(request)
    expect(response.headers.get('x-middleware-request-x-dcc-country')).toBe('ES')
    expect(response.headers.get('x-middleware-request-x-dcc-locale')).toBe('pt-BR')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('dcc_country=ES')
    expect(response.cookies.get('dcc_country')?.value).toBe('ES')
  })
  it('uses detected country and its language on the first visit', () => {
    const response = middleware(new NextRequest('https://www.dccmusic.online/planos', {
      headers: { host: 'www.dccmusic.online', 'x-vercel-ip-country': 'GB' },
    }))
    expect(response.headers.get('x-middleware-request-x-dcc-country')).toBe('GB')
    expect(response.headers.get('x-middleware-request-x-dcc-locale')).toBe('en-GB')
  })
  it('ignores invalid language preferences', () => {
    const response = middleware(new NextRequest('https://www.dccmusic.online/api/compositores/pagamento/intent', {
      headers: { host: 'www.dccmusic.online', 'x-vercel-ip-country': 'ES', cookie: 'dcc_locale=invalid' },
    }))
    expect(response.headers.get('x-middleware-request-x-dcc-country')).toBe('ES')
    expect(response.headers.get('x-middleware-request-x-dcc-locale')).toBe('es-ES')
  })
})

import { createDccI18n } from '../i18n/i18next'
import { supportedLocales } from '../i18n/config'

describe('localized preferences labels', () => {
  it.each(supportedLocales)('provides language and country correction labels for %s', async (locale) => {
    const i18n = await createDccI18n(locale)
    expect(i18n.exists('global.language.choose', { lng: locale, fallbackLng: false })).toBe(true)
    expect(i18n.exists('global.country.correction', { lng: locale, fallbackLng: false })).toBe(true)
    expect(i18n.exists('global.country.correctionHint', { lng: locale, fallbackLng: false })).toBe(true)
  })
})
