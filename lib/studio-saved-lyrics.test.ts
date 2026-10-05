import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), query: {} as any }))
vi.mock('@/lib/composer-middleware', () => ({ getComposerFromRequest: mocks.auth }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { GET } from '@/app/api/compositores/studio/saved-lyrics/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockReturnValue({ composerId: 'owner' })
  mocks.query = {}
  for (const name of ['select', 'eq', 'neq', 'order', 'limit']) mocks.query[name] = vi.fn(() => mocks.query)
  mocks.query.range = vi.fn().mockResolvedValue({ data: [], error: null })
  mocks.from.mockReturnValue(mocks.query)
})

describe('saved lyrics access', () => {
  it('rejects unauthenticated requests without querying user data', async () => {
    mocks.auth.mockReturnValue(null)
    expect((await GET(new NextRequest('https://dccmusic.online/api?page=0'))).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each(['-1', 'NaN', '1.2', '10001'])('rejects invalid page %s', async (page) => {
    expect((await GET(new NextRequest(`https://dccmusic.online/api?page=${page}`))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('restricts both the lyric and its project to the authenticated owner', async () => {
    const response = await GET(new NextRequest('https://dccmusic.online/api?page=2'))
    expect(response.status).toBe(200)
    expect(mocks.query.eq).toHaveBeenCalledWith('composer_id', 'owner')
    expect(mocks.query.eq).toHaveBeenCalledWith('studio_lyrics.composer_id', 'owner')
    expect(mocks.query.eq).toHaveBeenCalledWith('studio_lyrics.is_current', true)
    expect(mocks.query.range).toHaveBeenCalledWith(40, 60)
    expect(mocks.query.limit).toHaveBeenCalledWith(1, { referencedTable: 'studio_lyrics' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('returns complete multiline lyrics and detects the next page', async () => {
    const row = { id: 'project', title: 'Modão', studio_lyrics: [{ id: 'lyric', content: 'A\nPrimeira frase\n\nREFRÃO\nÚltima frase', updated_at: '2026-10-04' }] }
    mocks.query.range.mockResolvedValue({ data: Array(21).fill(row), error: null })
    const response = await GET(new NextRequest('https://dccmusic.online/api'))
    const data = await response.json()
    expect(data.hasMore).toBe(true)
    expect(data.lyrics).toHaveLength(20)
    expect(data.lyrics[0]).toEqual({ id: 'lyric', projectId: 'project', title: 'Modão', content: row.studio_lyrics[0].content, updatedAt: row.studio_lyrics[0].updated_at })
  })
  it('does not report a successful load on a database error', async () => {
    mocks.query.range.mockResolvedValue({ data: null, error: { message: 'failed' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { expect((await GET(new NextRequest('https://dccmusic.online/api'))).status).toBe(500) }
    finally { log.mockRestore() }
  })
})
