import { describe, expect, it } from 'vitest'
import { buildLyriaTimedLyrics } from '@/lib/lyria-timing'

describe('buildLyriaTimedLyrics', () => {
  it('distribui toda a letra dentro da duração escolhida', () => {
    const plan = buildLyriaTimedLyrics('[Verso]\nFrase curta\nUma frase consideravelmente maior para cantar com calma\n\n[Refrão]\nVolta pra mim', 100, 150)

    expect(plan).toContain('[00:00-00:05] Instrumental intro')
    expect(plan).toContain('[02:25-02:30] Instrumental outro')
    expect(plan).toContain('Frase curta')
    expect(plan).toContain('Uma frase consideravelmente maior para cantar com calma')
    expect(plan).toContain('Short instrumental breath')
  })

  it('dá mais tempo para frases maiores', () => {
    const plan = buildLyriaTimedLyrics('Oi\nEu preciso de bastante tempo para cantar todas estas palavras naturalmente', 100, 120)
    const ranges = [...plan.matchAll(/\[(\d{2}):(\d{2})-(\d{2}):(\d{2})] (.+)/g)]
      .filter((match) => !match[5].includes('Instrumental'))
      .map((match) => ({ seconds: Number(match[3]) * 60 + Number(match[4]) - Number(match[1]) * 60 - Number(match[2]), text: match[5] }))

    expect(ranges).toHaveLength(2)
    expect(ranges[1].seconds).toBeGreaterThan(ranges[0].seconds)
  })
})
