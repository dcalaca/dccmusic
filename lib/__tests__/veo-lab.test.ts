import { describe, expect, it } from 'vitest'
import { buildVeoLabScenePrompts, extractVeoVideoUri, isVeoLabAspectRatio } from '@/lib/veo-lab'

describe('Veo video lab helpers', () => {
  it('builds five distinct prompts with a locked cast', () => {
    const prompts = buildVeoLabScenePrompts({
      title: 'Reencontro', logline: 'Duas pessoas voltam a se encontrar.',
      characterBible: 'Same adult couple, blue coat and black jacket.',
      visualStyle: 'Cinematic rainy neon night.',
      scenes: Array.from({ length: 5 }, (_, index) => ({ title: `Cena ${index + 1}`, story: `Beat ${index + 1}`, videoPrompt: `Different action ${index + 1}`, caption: `Verso ${index + 1}` })),
    })
    expect(prompts).toHaveLength(5)
    expect(prompts[0]).toContain('Same adult couple')
    expect(new Set(prompts).size).toBe(5)
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
