import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAIAdsCheckoutContext } from './openai-ads-context'
import { sendOpenAIAdsPurchase, sendOpenAIAdsTopupPurchase } from './openai-ads-conversions'

const fetchMock = vi.fn()
const purchase = () => ({
  transactionId: 'topup_verified-id', amount: 2.99, currency: 'BRL', paidAt: new Date().toISOString(),
  composerId: 'Composer-AbC', email: ' Buyer@Example.com ', contentId: 'studio_topup' as const,
  metadata: { customer_country: 'BR', openai_ads: {
    oppref: 'opaque%2Fclick+ref', obref: 'browser-ref',
    source_url: 'https://www.dccmusic.online/checkout?email=private@example.com#secret',
    user_agent: 'Real Browser', ip_address: '2001:db8::1',
  } },
})
beforeEach(() => {
  vi.stubEnv('OPENAI_CONVERSIONS_API_KEY', 'unit-test-only')
  vi.stubEnv('NEXTAUTH_URL', 'https://www.dccmusic.online')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('OpenAI server purchases', () => {
  it('matches the existing pixel ID and event ID, hashes identifiers, and strips URL secrets', async () => {
    expect(await sendOpenAIAdsPurchase(purchase())).toEqual({ sent: true, reason: 'submitted' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://bzr.openai.com/v1/events?pid=7P9kR7YDnZBmFo76pXpiAq')
    const payload = JSON.parse(options.body)
    const event = payload.events[0]
    expect(payload.validate_only).toBe(false)
    expect(event).toMatchObject({ id: 'dcc_order_topup_verified-id', type: 'order_created', action_source: 'web',
      oppref: 'opaque%2Fclick+ref', source_url: 'https://www.dccmusic.online/checkout',
      data: { type: 'contents', amount: 299, currency: 'BRL' },
      user: { ip_address: '2001:db8::1', obref: 'browser-ref',
        emails_sha256: [createHash('sha256').update('buyer@example.com').digest('hex')],
        external_ids_sha256: [createHash('sha256').update('Composer-AbC').digest('hex')] } })
    expect(options.body).not.toContain('Buyer@Example.com')
    expect(options.body).not.toContain('Composer-AbC')
  })
  it.each([['BRL', 299], ['USD', 299], ['PYG', 3]])('uses documented minor units for %s', async (currency, amount) => {
    await sendOpenAIAdsPurchase({ ...purchase(), currency })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events[0].data.amount).toBe(amount)
  })
  it.each(['pending', 'failed', 'refunded'])('does not emit an unapproved %s topup', async status => {
    await sendOpenAIAdsTopupPurchase({ id: 'a', status, paid_at: new Date().toISOString(), amount: 2.99 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not invent timestamps for historical or undated payments', async () => {
    for (const paidAt of [undefined, 'invalid', new Date(Date.now() - 8 * 86400000).toISOString()]) {
      expect((await sendOpenAIAdsPurchase({ ...purchase(), paidAt })).sent).toBe(false)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('retries transient failures with identical event identity and actual purchase time', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await sendOpenAIAdsPurchase(purchase())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toEqual(fetchMock.mock.calls[1][1].body)
  })
  it('never throws network failures into checkout', async () => {
    fetchMock.mockRejectedValue(new Error('network failed'))
    await expect(sendOpenAIAdsPurchase(purchase())).resolves.toEqual({ sent: false, reason: 'transport_failed' })
  })
  it('does not repeatedly submit rejected credentials or expose the key in logs', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await sendOpenAIAdsPurchase(purchase())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('unit-test-only')
  })
  it('does not send webhook identity or untrusted URLs', async () => {
    await sendOpenAIAdsPurchase({ ...purchase(), metadata: { openai_ads: { source_url: 'https://evil.example/leak?email=secret' } } })
    const event = JSON.parse(fetchMock.mock.calls[0][1].body).events[0]
    expect(event.source_url).toBe('https://www.dccmusic.online/compositores/admin/studio-ia')
    expect(event.user).not.toHaveProperty('ip_address')
    expect(event.user).not.toHaveProperty('user_agent')
  })
})

describe('OpenAI checkout context', () => {
  it('captures raw cookie references without decoding, while rejecting offsite referrers', () => {
    const context = openAIAdsCheckoutContext(new Request('https://www.dccmusic.online/api/checkout', { headers: {
      cookie: '__oppref=abc%2Fxyz+123; __obref=browser', referer: 'https://evil.example/customer?email=private',
      'user-agent': 'Browser', 'x-forwarded-for': '203.0.113.1, 10.0.0.1',
    } }))
    expect(context).toMatchObject({ oppref: 'abc%2Fxyz+123', obref: 'browser', ip_address: '203.0.113.1',
      source_url: 'https://www.dccmusic.online/compositores/admin/studio-ia' })
  })
})
