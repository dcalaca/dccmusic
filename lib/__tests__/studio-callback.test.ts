import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getStudioCallbackUrl, isValidStudioCallback } from '../studio'

const SECRET = 'studio-callback-secret-xyz'

describe('getStudioCallbackUrl / isValidStudioCallback', () => {
  const originalCallbackSecret = process.env.STUDIO_CALLBACK_SECRET
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.STUDIO_CALLBACK_SECRET = SECRET
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.dccmusic.online'
  })

  afterEach(() => {
    process.env.STUDIO_CALLBACK_SECRET = originalCallbackSecret
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })

  it('inclui o segredo na URL de callback quando configurado', () => {
    const url = getStudioCallbackUrl('/api/studio/suno/callback')
    expect(url).toContain('/api/studio/suno/callback')
    expect(url).toContain(`secret=${SECRET}`)
  })

  it('aceita callback com o segredo correto na query', () => {
    const url = getStudioCallbackUrl('/api/studio/suno/callback')
    const request = new Request(url, { method: 'POST' })
    expect(isValidStudioCallback(request)).toBe(true)
  })

  it('aceita callback com o segredo correto no header', () => {
    const request = new Request('https://www.dccmusic.online/api/studio/suno/callback', {
      method: 'POST',
      headers: { 'x-callback-secret': SECRET },
    })
    expect(isValidStudioCallback(request)).toBe(true)
  })

  it('recusa callback sem segredo', () => {
    const request = new Request('https://www.dccmusic.online/api/studio/suno/callback', { method: 'POST' })
    expect(isValidStudioCallback(request)).toBe(false)
  })

  it('recusa callback com segredo errado', () => {
    const request = new Request('https://www.dccmusic.online/api/studio/suno/callback?secret=errado', { method: 'POST' })
    expect(isValidStudioCallback(request)).toBe(false)
  })

  it('não bloqueia quando o segredo não está configurado (compatibilidade)', () => {
    delete process.env.STUDIO_CALLBACK_SECRET
    const request = new Request('https://www.dccmusic.online/api/studio/suno/callback', { method: 'POST' })
    expect(isValidStudioCallback(request)).toBe(true)
  })
})
