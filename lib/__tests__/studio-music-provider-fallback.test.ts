import { describe, expect, it } from 'vitest'
import { isNonFallbackableSunoFailure } from '../studio-music-provider-fallback'
import { getTransparentStudioGenerationError } from '../studio-generation-timeout'

describe('isNonFallbackableSunoFailure', () => {
  it('bloqueia fallback para direitos autorais', () => {
    expect(isNonFallbackableSunoFailure({
      data: { errorMessage: 'Your lyrics contain copyrighted material. Please change it and try again.' },
    })).toBe(true)
  })

  it('bloqueia fallback para conteúdo sensível', () => {
    expect(isNonFallbackableSunoFailure({ data: { status: 'SENSITIVE_WORD_ERROR' } })).toBe(true)
  })

  it('bloqueia fallback para voz inválida', () => {
    expect(isNonFallbackableSunoFailure({ message: 'Voice persona expired and unavailable' })).toBe(true)
  })

  it('permite fallback para falha técnica', () => {
    expect(isNonFallbackableSunoFailure({
      data: { status: 'GENERATE_AUDIO_FAILED', errorMessage: 'Upstream service temporarily unavailable' },
    })).toBe(false)
  })

  it('permite fallback para timeout', () => {
    expect(isNonFallbackableSunoFailure({ message: 'Generation timed out' })).toBe(false)
  })
})

describe('getTransparentStudioGenerationError', () => {
  it('explica direitos autorais sem revelar fornecedor', () => {
    const message = getTransparentStudioGenerationError('Your lyrics contain copyrighted material. Please change it and try again.')
    expect(message).toContain('música já existente')
    expect(message).toContain('Nenhum crédito foi descontado')
    expect(message.toLowerCase()).not.toContain('suno')
    expect(message.toLowerCase()).not.toContain('mureka')
  })

  it('preserva um motivo desconhecido sem revelar fornecedor', () => {
    const message = getTransparentStudioGenerationError('Mureka renderer failed while processing audio')
    expect(message).toContain('renderer failed while processing audio')
    expect(message.toLowerCase()).not.toContain('mureka')
    expect(message).toContain('Nenhum crédito foi descontado')
  })
})
