import { describe, expect, it } from 'vitest'
import {
  normalizeStudioLyricStructure,
  studioLyricWordsMatch,
} from '../studio-lyric-normalizer'

describe('normalizeStudioLyricStructure', () => {
  it('quebra texto corrido em linhas cantáveis sem trocar palavras', () => {
    const input = 'Eu fui embora porque meu coração cansou de esperar, mas ainda lembro de você quando a noite chega e tudo fica em silêncio.'

    const result = normalizeStudioLyricStructure(input)

    expect(result.changed).toBe(true)
    expect(result.linesAfter).toBeGreaterThan(result.linesBefore)
    expect(result.lyric).toContain('\n')
    expect(studioLyricWordsMatch(input, result.lyric)).toBe(true)
  })

  it('preserva as palavras e a ordem da letra original', () => {
    const input = 'Meu amor ficou aqui\nE o tempo não levou\n[Refrão]\nMeu amor ficou aqui'

    const result = normalizeStudioLyricStructure(input)

    expect(studioLyricWordsMatch(input, result.lyric)).toBe(true)
  })

  it('não inventa conteúdo quando a entrada está vazia', () => {
    const result = normalizeStudioLyricStructure('   ')

    expect(result.lyric).toBe('')
    expect(result.changed).toBe(false)
    expect(result.linesAfter).toBe(0)
  })
})
