import { describe, expect, it } from 'vitest'
import { getVeoLabApiKey, signVeoLabMediaUri, verifyVeoLabMediaUri } from '@/lib/veo-lab-media'

describe('Veo video lab media signatures', () => {
  it('signs and verifies an unchanged Google media URI', () => {
    process.env.JWT_SECRET = 'test-secret'
    const uri = 'https://generativelanguage.googleapis.com/video.mp4'
    const signature = signVeoLabMediaUri(uri)
    expect(verifyVeoLabMediaUri(uri, signature)).toBe(true)
    expect(verifyVeoLabMediaUri(`${uri}?changed=1`, signature)).toBe(false)
  })

  it('recognizes the conventional Google API key aliases', () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
    process.env.GOOGLE_API_KEY = 'existing-google-key'
    expect(getVeoLabApiKey()).toBe('existing-google-key')
    delete process.env.GOOGLE_API_KEY
  })
})
