import { describe, expect, it } from 'vitest'
import { buildLyriaCreativeDirection, buildLyriaLyricPrompt, normalizeLyriaStudioSettings } from '../lyria-studio'

describe('Lyria Studio creative direction', () => {
  it('includes the actual genre, voice, instruments, language and user instructions', () => {
    const settings = normalizeLyriaStudioSettings({
      title: 'Chave Falsa', style: 'Pagode', mood: 'Romântica', songLanguage: 'Português (Brasil)',
      voiceGender: 'Voz feminina', voiceTone: 'Voz rouca', wantInstruments: 'cavaquinho, tantã',
      avoidInstruments: 'guitarra distorcida', extraInstructions: 'refrão intimista',
    })
    const direction = buildLyriaCreativeDirection(settings)

    expect(direction).toContain('Pagode')
    expect(direction).toContain('Voz feminina, Voz rouca')
    expect(direction).toContain('cavaquinho, tantã')
    expect(direction).toContain('guitarra distorcida')
    expect(direction).toContain('refrão intimista')
  })

  it('protects the identity of moda de viola in both generation stages', () => {
    const settings = normalizeLyriaStudioSettings({ style: 'Moda de Viola', title: 'Estrada', idea: 'Uma volta para casa' })

    expect(buildLyriaCreativeDirection(settings)).toContain('never modern universitário')
    expect(buildLyriaLyricPrompt(settings, 150)).toContain('sertanejo raiz tradicional')
    expect(buildLyriaLyricPrompt(settings, 150)).toContain('150 segundos')
    expect(buildLyriaLyricPrompt(settings, 150)).toContain('Nunca escreva título')
  })
})
