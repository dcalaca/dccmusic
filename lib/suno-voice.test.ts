import { describe, expect, it } from 'vitest'
import { extractSunoVoiceId } from './suno-voice'

describe('extractSunoVoiceId', () => {
  it('uses only the explicit voice id returned by the provider', () => {
    expect(extractSunoVoiceId({ data: { voiceId: 'voice-123', id: 'internal-id' } })).toBe('voice-123')
  })

  it('does not treat a generic provider data.id as a voice id', () => {
    expect(extractSunoVoiceId({ data: { id: 'internal-id' } })).toBeNull()
  })
})
