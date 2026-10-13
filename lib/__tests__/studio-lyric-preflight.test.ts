import { describe, expect, it } from 'vitest'
import { getStudioLyricPreflight } from '../studio-lyric-preflight'

describe('getStudioLyricPreflight', () => {
  it('identifica o comentário do caso Neya sem remover o texto', () => {
    const input = '[Refrão]\nMeu Deus, em Ti confio\nEsse é o seu refrão!\nEu deixei ele com as suas próprias palavras,\nsó mais curto e forte.'
    const result = getStudioLyricPreflight(input)
    expect(result.suspiciousLines).toContain('Esse é o seu refrão!')
    expect(result.suspiciousLines.some(line => line.includes('só mais curto e forte'))).toBe(true)
    expect(result.sentLyric).toContain('Meu Deus, em Ti confio')
    expect(result.sentLyric).toContain('Esse é o seu refrão!')
  })

  it('preserva seções e não confunde refrão normal com observações', () => {
    const result = getStudioLyricPreflight('[Verso 1]\nSenhor, a Ti eu clamo\n[Refrão]\nTu és a minha força')
    expect(result.suspiciousLines).toEqual([])
    expect(result.sentLyric).toContain('[Refrão]')
  })

  it('mostra explicitamente o corte aplicado pelo endpoint para letras longas', () => {
    const result = getStudioLyricPreflight('cantar '.repeat(800))
    expect(result.truncated).toBe(true)
    expect(result.sentLyric.length).toBe(5000)
  })
})
