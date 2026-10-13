import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), auth: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('@/lib/composer-middleware', () => ({ getComposerFromRequest: mocks.auth, resolveComposerToken: mocks.resolve }))
import { GET as dashboard } from '@/app/api/compositores/indicacoes/route'
import { GET as referralLink } from '@/app/i/[code]/route'
import { attributeNewComposerReferral, REFERRAL_COOKIE } from './referrals'

const visitId = '00000000-0000-4000-8000-000000000001'
function chain(result: object) {
  const value: any = { maybeSingle: vi.fn().mockResolvedValue(result), single: vi.fn().mockResolvedValue(result) }
  for (const name of ['select', 'eq', 'gte', 'upsert']) value[name] = vi.fn(() => value)
  return value
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue({ composerId: 'owner' }); mocks.resolve.mockResolvedValue({ composerId: 'owner' }); mocks.rpc.mockResolvedValue({ data: { code: '0123456789abcdef' }, error: null }) })

describe('referral dashboard authorization and pagination', () => {
  it('requires an authenticated account', async () => {
    mocks.auth.mockReturnValue(null)
    expect((await dashboard(new NextRequest('https://dccmusic.online/api/compositores/indicacoes'))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses the authenticated owner, never a supplied composer ID', async () => {
    const response = await dashboard(new NextRequest('https://dccmusic.online/api/compositores/indicacoes?composerId=other&page=3&start=2026-10-01&end=2026-10-13'))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('dcc_referral_dashboard', expect.objectContaining({ p_composer_id: 'owner', p_page: 3, p_page_size: 10, p_to: '2026-10-14T00:00:00-03:00' }))
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
  it.each(['0', '-1', 'NaN', '1.5', '100000000'])('rejects invalid page %s', async page => {
    expect((await dashboard(new NextRequest(`https://dccmusic.online/api/compositores/indicacoes?page=${page}`))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects reversed dates before querying any metrics', async () => {
    expect((await dashboard(new NextRequest('https://dccmusic.online/api/compositores/indicacoes?start=2026-10-13&end=2026-10-12'))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
describe('referral attribution and redirect', () => {
  it('takes only the opaque cookie and the server-created composer ID', async () => {
    const request = new NextRequest('https://dccmusic.online/api/compositores/cadastro', { headers: { cookie: `${REFERRAL_COOKIE}=${visitId}` } })
    await attributeNewComposerReferral(request, 'new-composer')
    expect(mocks.rpc).toHaveBeenCalledWith('dcc_attribute_referral', { p_composer_id: 'new-composer', p_visit_id: visitId })
  })
  it('ignores absent or invalid cookies', async () => {
    await attributeNewComposerReferral(new NextRequest('https://dccmusic.online/', { headers: { cookie: `${REFERRAL_COOKIE}=bad` } }), 'new-composer')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('preserves ad click IDs and existing campaign parameters', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    const response = await referralLink(new NextRequest('https://dccmusic.online/i/0123456789abcdef?gclid=google-click&fbclid=meta-click&utm_source=google'), { params: { code: '0123456789abcdef' } })
    const url = new URL(response.headers.get('location')!)
    expect(url.pathname).toBe('/studio-ia')
    expect(url.searchParams.get('gclid')).toBe('google-click')
    expect(url.searchParams.get('fbclid')).toBe('meta-click')
    expect(url.searchParams.get('utm_source')).toBe('google')
  })
  it('does not count messaging previews as clicks', async () => {
    const response = await referralLink(new NextRequest('https://dccmusic.online/i/0123456789abcdef', { headers: { 'user-agent': 'WhatsApp/2.0' } }), { params: { code: '0123456789abcdef' } })
    expect(response.status).toBe(302)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('records a real visit and sets a protected attribution cookie', async () => {
    mocks.from.mockReturnValueOnce(chain({ data: { composer_id: 'owner' }, error: null })).mockReturnValueOnce(chain({ data: { id: visitId }, error: null }))
    const response = await referralLink(new NextRequest('https://dccmusic.online/i/0123456789abcdef', { headers: { 'user-agent': 'Mozilla/5.0' } }), { params: { code: '0123456789abcdef' } })
    expect(response.cookies.get(REFERRAL_COOKIE)?.value).toBe(visitId)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })
  it('keeps the first valid referral when another link is clicked', async () => {
    mocks.from.mockReturnValueOnce(chain({ data: { composer_id: 'new-owner' }, error: null })).mockReturnValueOnce(chain({ data: { id: visitId }, error: null })).mockReturnValueOnce(chain({ data: { id: 'previous' }, error: null }))
    const response = await referralLink(new NextRequest('https://dccmusic.online/i/0123456789abcdef', { headers: { 'user-agent': 'Mozilla/5.0', cookie: `${REFERRAL_COOKIE}=${visitId}` } }), { params: { code: '0123456789abcdef' } })
    expect(response.cookies.get(REFERRAL_COOKIE)).toBeUndefined()
  })
})
