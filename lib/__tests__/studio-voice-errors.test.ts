import { describe, expect, it } from 'vitest'
import {
  isStudioVoiceExpiredError,
  translateStudioVoiceError,
  VOICE_EXPIRED_ERROR_MESSAGE,
} from '../studio-voice-errors'

describe('erros de vozes expiradas', () => {
  it('reconhece mensagens antigas em português salvas no banco', () => {
    const previousMessage = 'Essa voz cadastrada expirou e não pode mais ser usada. Envie/grave a voz novamente.'

    expect(isStudioVoiceExpiredError(previousMessage)).toBe(true)
    expect(translateStudioVoiceError(previousMessage)).toBe(VOICE_EXPIRED_ERROR_MESSAGE)
  })

  it('reconhece mensagens em inglês devolvidas pelo fornecedor', () => {
    expect(isStudioVoiceExpiredError('This voice has expired. Please recreate the voice.')).toBe(true)
  })

  it('não confunde expiração da frase com expiração da voz', () => {
    expect(isStudioVoiceExpiredError('verification phrase expired')).toBe(false)
    expect(translateStudioVoiceError('verification phrase expired')).toBe(
      'A frase de verificação expirou ou não foi encontrada. Gere uma nova frase e grave novamente.'
    )
  })
})
