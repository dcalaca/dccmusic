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

  it('transforma nomes soltos das partes em seções que nunca recebem tempo de canto', () => {
    const lyric = 'Verso 1\nA gente conversa todo dia\n\nPré-Refrão\nCalma, não complica a vida\n\nRefrão:\nBora de motelzinho\n\nPonte\nSem drama, sem maldade\n\nFinal\nSó pra matar a vontade'
    const clean = sanitizeLyriaLyrics(lyric)
    const plan = buildLyriaTimedLyrics(clean, 100, 150)

    expect(clean).toContain('[Verso 1]')
    expect(clean).toContain('[Pré-Refrão]')
    expect(clean).toContain('[Refrão]')
    expect(clean).toContain('[Ponte]')
    expect(clean).toContain('[Final]')
    expect(plan).not.toMatch(/\[\d{2}:\d{2}-\d{2}:\d{2}] (?:Verso 1|Pré-Refrão|Refrão|Ponte|Final)/)
    expect(plan).toContain('Bora de motelzinho')
    expect(estimateLyriaSongDuration(clean, 100).phraseCount).toBe(5)
  })

  it('preserva palavras estruturais quando fazem parte de uma frase cantada', () => {
    const lyric = 'Eu canto esse refrão pra você\nNossa ponte ainda não caiu\nNo final eu volto pra casa\nEsse verso é todo seu'
    const clean = sanitizeLyriaLyrics(lyric)
    const plan = buildLyriaTimedLyrics(clean, 100, 120)

    expect(clean).toBe(lyric)
    expect(plan).toContain('Eu canto esse refrão pra você')
    expect(plan).toContain('Nossa ponte ainda não caiu')
    expect(plan).toContain('No final eu volto pra casa')
    expect(estimateLyriaSongDuration(clean, 100).phraseCount).toBe(4)
  })

  it('reconhece marcações em português, espanhol e inglês com pequenas variações', () => {
    const clean = sanitizeLyriaLyrics('(Introdução)\nSom de viola\nPRE REFRAO\nChega mais perto\nEstribillo\nDime que sí\nBridge\nNever let me go\nChorus 2x\nCanta comigo')

    expect(clean).toContain('[Introdução]')
    expect(clean).toContain('[PRE REFRAO]')
    expect(clean).toContain('[Estribillo]')
    expect(clean).toContain('[Bridge]')
    expect(clean).toContain('[Chorus 2x]')
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
