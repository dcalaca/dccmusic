export type StemType = 'vocal' | 'drums' | 'bass' | 'others'

export type Stem = {
  id: string
  name: string
  type: StemType
  volume: number
  muted: boolean
  solo: boolean
  /** URL do áudio do stem — null até a API real existir */
  url: string | null
}

export type StudioProject = {
  id: string
  title: string
  artist: string
  coverUrl: string | null
  /** Mix/master preview — pode ficar vazio no MVP */
  audioUrl: string | null
}

/** Corte do trecho da música (grátis — não gera cobrança extra) */
export type AudioTrim = {
  startSec: number
  /** null = até o fim da faixa */
  endSec: number | null
}
