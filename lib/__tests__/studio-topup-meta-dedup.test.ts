import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const downstream = vi.hoisted(() => ({ ga4: vi.fn(), tiktok: vi.fn() }))
vi.mock('@/lib/ga4-server-purchase', () => ({ sendConfirmedTopupGa4Purchase: downstream.ga4 }))
vi.mock('@/lib/tiktok-events', () => ({ sendTikTokPurchaseEvent: downstream.tiktok }))
import { sendStudioTopupPurchaseEvents } from '@/lib/studio-topup-meta'

const topupId = '17e784b9-9eb5-4852-b697-d7018fcaf569'
const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('META_CONVERSIONS_ACCESS_TOKEN', 'test-only-token')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ events_received: 1 }) })
  downstream.ga4.mockResolvedValue({ sent: true })
  downstream.tiktok.mockResolvedValue({ sent: true })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Meta top-up purchase deduplication', () => {
  it.each(['pi_stripe_123', '184626004774'])('matches both browser pages for gateway payment %s', async paymentId => {
    const topup = { id: topupId, composer_id: 'composer-id', amount: 2.99, currency: 'USD', music_quantity: 1 }
    await sendStudioTopupPurchaseEvents({ topup, paymentId, email: 'test@example.com' })
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    const event = payload.data[0]
    expect(event.event_name).toBe('Purchase')
    expect(event.event_id).toBe(`topup_${topupId}`)
    expect(event.custom_data).toMatchObject({ value: 2.99, currency: 'USD' })
    for (const page of ['sucesso', 'pendente']) {
      const source = readFileSync(`app/compositores/admin/studio-ia/recarga/${page}/page.tsx`, 'utf8')
      expect(source).toContain('const eventId = `topup_${topupId}`')
      expect(source).toContain('eventID: eventId')
    }
    expect(downstream.ga4).toHaveBeenCalledWith({ request: undefined, topup })
    expect(downstream.tiktok).toHaveBeenCalledWith(expect.objectContaining({ eventId: paymentId }))
  })
  it('keeps different real purchases distinct even for the same buyer', async () => {
    for (const id of ['purchase-a', 'purchase-b']) {
      await sendStudioTopupPurchaseEvents({ topup: { id, composer_id: 'same-buyer', amount: 2.99 }, paymentId: `gateway-${id}`, email: 'test@example.com' })
    }
    const ids = fetchMock.mock.calls.map(call => JSON.parse(call[1].body).data[0].event_id)
    expect(new Set(ids).size).toBe(2)
  })
  it('does not emit an ambiguous conversion without a top-up ID', async () => {
    expect(await sendStudioTopupPurchaseEvents({ topup: { amount: 2.99 }, paymentId: 'gateway-id', email: 'test@example.com' }))
      .toEqual({ sent: false, reason: 'missing_topup_id' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
