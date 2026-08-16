import { describe, expect, it } from 'vitest'
import {
  buildMurekaLyricsVideoPayload,
  extractMurekaLyricsVideoUrl,
  getStudioVersionDurationMs,
  getStudioVideoAudioId,
  isMurekaStudioTrack,
  isSunoRecordMissingError,
  translateStudioVideoProviderError,
} from '../studio-video-helpers'

describe('getStudioVideoAudioId', () => {
  it('usa o id da versão escolhida, não o da geração', () => {
    const audioId = getStudioVideoAudioId(
      { provider_payload: { id: '155529345302532' } },
      { provider_audio_id: '155529345302533' }
    )
    expect(audioId).toBe('155529345302532')
  })

  it('cai no id da geração quando a versão não tem payload', () => {
    expect(getStudioVideoAudioId({}, { provider_audio_id: 'audio-geracao' })).toBe('audio-geracao')
  })
})

describe('isMurekaStudioTrack', () => {
  it('reconhece geração Mureka pelo provider', () => {
    expect(isMurekaStudioTrack({ provider: 'mureka' })).toBe(true)
  })

  it('reconhece áudio hospedado na Mureka mesmo sem provider', () => {
    expect(isMurekaStudioTrack(
      {},
      { audio_url: 'https://cdn.mureka.ai/cos-prod/open/song/20260816/140650951540737-EU1mE1mXBbkMx2Bs7rrj2C.mp3' }
    )).toBe(true)
  })

  it('não trata faixa Suno como Mureka', () => {
    expect(isMurekaStudioTrack(
      { provider: 'sunoapi' },
      { audio_url: 'https://cdn1.suno.ai/abc.mp3' }
    )).toBe(false)
  })
})

describe('buildMurekaLyricsVideoPayload', () => {
  it('monta payload de vídeo com letra da Mureka para a música inteira', () => {
    expect(buildMurekaLyricsVideoPayload({
      songId: '155529345302533',
      title: 'Quando Mundo Parava',
      coverUrl: 'https://example.com/capa.png',
      durationMs: 241990,
    })).toEqual({
      song_id: '155529345302533',
      title: 'Quando Mundo Parava',
      aspect_ratio: '9:16',
      layout: 'layout_2',
      cover: 'https://example.com/capa.png',
      selection_start: 0,
      selection_end: 241990,
    })
  })

  it('usa layout_1 quando não há capa, porque layout_1 não aceita cover', () => {
    const payload = buildMurekaLyricsVideoPayload({
      songId: '123',
      title: 'Teste',
    })
    expect(payload.layout).toBe('layout_1')
    expect(payload.cover).toBeUndefined()
  })
})

describe('extractMurekaLyricsVideoUrl / duration / erros', () => {
  it('lê a URL do vídeo na resposta da Mureka', () => {
    expect(extractMurekaLyricsVideoUrl({ url: 'https://cdn.mureka.ai/1.mp4' })).toBe('https://cdn.mureka.ai/1.mp4')
  })

  it('converte duração em milissegundos ou segundos', () => {
    expect(getStudioVersionDurationMs({ provider_payload: { duration: 241990 } })).toBe(241990)
    expect(getStudioVersionDurationMs({ provider_payload: { duration: 241 } })).toBe(241000)
  })

  it('identifica o erro Record does not exist da Suno', () => {
    expect(isSunoRecordMissingError({ msg: 'Record does not exist', code: 400 })).toBe(true)
  })

  it('traduz o erro da Suno para o compositor', () => {
    expect(translateStudioVideoProviderError('Record does not exist')).toContain('outro estúdio de IA')
  })
})
