import { beforeEach, describe, expect, it, vi } from 'vitest'
const { requestHeaders } = vi.hoisted(() => ({ requestHeaders: new Headers() }))
vi.mock('next/headers', () => ({ headers: () => requestHeaders }))
import { createDccI18n } from '../i18n/server'

describe('server-rendered language preferences', () => {
  beforeEach(() => { requestHeaders.delete('x-dcc-locale') })
  it('renders Spanish copy even when the country defaults to Brazilian Portuguese', async () => {
    requestHeaders.set('x-dcc-locale', 'es-ES')
    const i18n = await createDccI18n('pt-BR')
    expect(i18n.language).toBe('es-ES')
    expect(i18n.t('menu.plans')).toBe('Planes')
  })
  it.each(['en-US', 'en-GB'])('renders all top-up card labels in %s while prices remain Brazilian', async (locale) => {
    requestHeaders.set('x-dcc-locale', locale)
    const i18n = await createDccI18n('pt-BR')
    expect(i18n.t('payment.plans.topup.one')).toBe('1 song')
    expect(i18n.t('payment.plans.topup.twoToEight')).toBe('2 to 8 songs')
    expect(i18n.t('payment.plans.topup.nineToTwentyNine')).toBe('9 to 29 songs')
    expect(i18n.t('payment.plans.topup.thirtyPlus')).toBe('30+ songs')
    expect(i18n.t('payment.plans.topup.perSong')).toBe('per song')
  })
  it('renders the top-up price suffix in Spanish', async () => {
    requestHeaders.set('x-dcc-locale', 'es-ES')
    expect((await createDccI18n('pt-BR')).t('payment.plans.topup.perSong')).toBe('por canción')
  })
  it('preserves the regional default without a language preference', async () => {
    expect((await createDccI18n('en-GB')).language).toBe('en-GB')
  })
  it('ignores unsupported language preferences', async () => {
    requestHeaders.set('x-dcc-locale', 'invalid')
    expect((await createDccI18n('pt-BR')).language).toBe('pt-BR')
  })
})
