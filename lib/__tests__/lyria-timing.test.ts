import { describe, expect, it } from 'vitest'
import { buildLyriaTimedLyrics, estimateLyriaSongDuration, LYRIA_MAX_DURATION_SECONDS, sanitizeLyriaLyrics } from '@/lib/lyria-timing'

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

  it('remove título, Markdown e outros metadados antes da letra cantada', () => {
    const lyric = '**Título: Teste**\n**Artista: Douglas**\n\n**[Verso 1]**\nNa brisa suave, eu sinto seu perfume\n\n[Refrão]\nVolta pra mim'
    const clean = sanitizeLyriaLyrics(lyric, 'Teste')
    const plan = buildLyriaTimedLyrics(clean, 100, 150)

    expect(clean).not.toContain('Título')
    expect(clean).not.toContain('Douglas')
    expect(clean).not.toContain('**')
    expect(clean).toContain('[Verso 1]')
    expect(plan).not.toContain('Teste')
    expect(plan).toContain('Na brisa suave, eu sinto seu perfume')
  })

  it('calcula a duração naturalmente a partir das frases e do BPM', () => {
    const shortLyric = '[Verso]\nEu volto para casa\nVocê me espera na varanda'
    const longerLyric = Array.from({ length: 32 }, (_, index) => `Na memória da nossa história eu reencontro você ${index}`).join('\n')
    const shorter = estimateLyriaSongDuration(shortLyric, 100)
    const longer = estimateLyriaSongDuration(longerLyric, 100)

    expect(shorter.durationSeconds).toBe(120)
    expect(longer.naturalDurationSeconds).toBeGreaterThan(shorter.naturalDurationSeconds)
    expect(longer.durationSeconds).toBeLessThanOrEqual(LYRIA_MAX_DURATION_SECONDS)
  })

  it('identifica letras que ultrapassam o limite real do Google', () => {
    const hugeLyric = Array.from({ length: 90 }, () => 'Eu preciso de muito tempo para cantar todas estas palavras naturalmente').join('\n')
    const estimate = estimateLyriaSongDuration(hugeLyric, 90)

    expect(estimate.exceedsModelLimit).toBe(true)
    expect(estimate.durationSeconds).toBe(LYRIA_MAX_DURATION_SECONDS)
  })
})
