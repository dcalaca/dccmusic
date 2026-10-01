import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/composer-middleware', () => ({ getComposerFromRequest: vi.fn(() => ({ id: 'test' })) }))
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { POST } from '@/app/api/compositores/studio/download-proxy/route'
const request = (url: string, mediaType = 'audio') => new NextRequest('https://dccmusic.online/api/compositores/studio/download-proxy', { method: 'POST', body: JSON.stringify({ url, mediaType }) })
beforeEach(() => { vi.restoreAllMocks(); vi.mocked(getComposerFromRequest).mockReturnValue({ id: 'test' } as any) })
it('returns an MP4 attachment with a video MIME type for mobile file sharing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([0,0,0,24]), { headers: { 'content-type': 'application/octet-stream' } })))
  const response = await POST(request('https://tempfile.aiquickdraw.com/r/example.mp4', 'video'))
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('video/mp4')
  expect(response.headers.get('content-disposition')).toContain('.mp4')
  expect((await response.arrayBuffer()).byteLength).toBe(4)
})
it('downloads provider MP3s through the proxy', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('audio', { headers: { 'content-type': 'application/octet-stream' } })))
  const response = await POST(request('https://audiostream.api.box/stream/example.mp3'))
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('audio/mpeg')
})
it('rejects unauthorized requests and unknown origins', async () => {
  expect((await POST(request('https://example.com/audio.mp3'))).status).toBe(400)
  vi.mocked(getComposerFromRequest).mockReturnValue(null)
  expect((await POST(request('https://cdn1.suno.ai/audio.mp3'))).status).toBe(401)
})
it('reports upstream failure instead of returning a link or empty file', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
  expect((await POST(request('https://cdn1.suno.ai/audio.mp3'))).status).toBe(502)
})
