import { describe, expect, it } from 'vitest'
import { signVeoLabMediaUri, verifyVeoLabMediaUri } from '@/lib/veo-lab-media'

describe('Veo video lab media signatures', () => {
  it('signs and verifies an unchanged Google media URI', () => {
    process.env.JWT_SECRET = 'test-secret'
    const uri = 'https://generativelanguage.googleapis.com/video.mp4'
    const signature = signVeoLabMediaUri(uri)
    expect(verifyVeoLabMediaUri(uri, signature)).toBe(true)
    expect(verifyVeoLabMediaUri(`${uri}?changed=1`, signature)).toBe(false)
  })
})
