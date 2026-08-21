import { describe, expect, it } from 'vitest'
import { buildVeoLabScenePrompts, extractVeoVideoUri, isVeoLabAspectRatio } from '@/lib/veo-lab'

describe('Veo video lab helpers', () => {
  it('builds four distinct, coherent scene prompts', () => {
    const prompts = buildVeoLabScenePrompts('  casal   na chuva  ')
    expect(prompts).toHaveLength(4)
    expect(prompts[0]).toContain('casal na chuva')
    expect(new Set(prompts).size).toBe(4)
  })

  it('accepts only supported aspect ratios', () => {
    expect(isVeoLabAspectRatio('9:16')).toBe(true)
    expect(isVeoLabAspectRatio('16:9')).toBe(true)
    expect(isVeoLabAspectRatio('1:1')).toBe(false)
  })

  it('extracts the generated video URI from the long-running response', () => {
    expect(extractVeoVideoUri({ response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://example.test/video' } }] } } })).toBe('https://example.test/video')
  })

})
