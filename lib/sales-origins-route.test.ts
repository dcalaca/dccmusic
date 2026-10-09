import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { GET } from '@/app/api/admin/reports/sales-origins/route'

const request = (range = 'startDate=2026-10-09&endDate=2026-10-09') => new NextRequest(`https://dccmusic.online/api/admin/reports/sales-origins?${range}`)
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'admin' } }) })
describe('sales origins report access and pagination', () => {
  it('rejects anonymous access before querying payments', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(request())).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects impossible dates and reversed ranges', async () => {
    expect((await GET(request('startDate=2026-02-30&endDate=2026-03-01'))).status).toBe(400)
    expect((await GET(request('startDate=2026-10-10&endDate=2026-10-09'))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('includes all pages and deduplicates a payment appearing twice', async () => {
    const range = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      const chain: any = {}
      for (const method of ['select', 'gte', 'lt', 'order', 'eq', 'gt', 'not', 'range']) chain[method] = vi.fn((...args: any[]) => {
        if (method === 'range') { chain.offset = args[0]; range(table, args[0]) }
        return chain
      })
      chain.then = (resolve: any) => resolve({ data: table === 'studio_credit_topups' ? (chain.offset === 0 ? Array.from({ length: 1000 }, (_, i) => ({ id: String(i), payment_id: i === 999 ? '0' : String(i), amount: 10, currency: 'BRL', paid_at: '2026-10-09T10:00:00Z', attribution_source: 'bing' })) : [{ id: '1000', payment_id: '1000', amount: 5, currency: 'USD', paid_at: '2026-10-09T11:00:00Z', attribution_source: 'bing' }]) : [], error: null })
      return chain
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    const report = await response.json()
    expect(range).toHaveBeenCalledWith('studio_credit_topups', 1000)
    expect(report.rows).toHaveLength(1000)
    expect(report.groups).toEqual([{ origin: 'Bing', count: 1000, amounts: { BRL: 9990, USD: 5 } }])
  })
})
