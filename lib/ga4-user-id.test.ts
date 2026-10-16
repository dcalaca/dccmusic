import { afterEach, expect, it, vi } from 'vitest'
import { syncGa4UserId, validGa4UserId } from './ga4-user-id'
const id = 'c38c5ec6-cb07-4705-a4c2-79406ed7ab41'
afterEach(() => vi.unstubAllGlobals())
it('accepts only internal UUIDs, never names, email or slugs', () => {
  expect(validGa4UserId(id)).toBe(true)
  for (const value of [null, '', 'name@example.com', 'andrea-rezende', 123]) expect(validGa4UserId(value)).toBe(false)
})
it('sets only GA4 identity, avoids duplicate page views, and clears on logout', () => {
  const data = new Map([['composer_token', 'session'], ['composer_data', JSON.stringify({ id })]])
  const gtag = vi.fn()
  vi.stubGlobal('window', { gtag, localStorage: { getItem: (key: string) => data.get(key) || null } })
  syncGa4UserId()
  expect(gtag).toHaveBeenLastCalledWith('config', 'G-CNBQFWQ9QT', { user_id: id, send_page_view: false })
  syncGa4UserId()
  expect(gtag).toHaveBeenCalledTimes(1)
  data.delete('composer_token')
  syncGa4UserId()
  expect(gtag).toHaveBeenLastCalledWith('config', 'G-CNBQFWQ9QT', { user_id: null, send_page_view: false })
})
it('sends the same internal UUID in server purchases only after payment approval', async () => {
  const { sendConfirmedTopupGa4Purchase } = await import('./ga4-server-purchase')
  vi.stubEnv('GA4_API_SECRET', 'test-secret')
  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  const topup = { id, composer_id: id, status: 'pending', amount: 2.99, currency: 'BRL', metadata: { ga4: { client_id: '123.456', session_id: '1792140000' } } }
  await sendConfirmedTopupGa4Purchase({ topup })
  expect(fetchMock).not.toHaveBeenCalled()
  await sendConfirmedTopupGa4Purchase({ topup: { ...topup, status: 'paid' } })
  const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(payload.user_id).toBe(id)
  expect(payload.client_id).toBe('123.456')
  expect(payload.events[0].params.transaction_id).toBe('topup_' + id)
  vi.unstubAllEnvs()
})
