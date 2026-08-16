import type { BlogProduct } from './types'

export const blogProducts: BlogProduct[] = [
  {
    id: 'studio-ia',
    label: 'Studio IA',
    description: 'Crie letras, músicas completas, capas e versões com inteligência artificial.',
    path: '/studio-ia',
    defaultCta: 'Criar música no Studio IA',
  },
  {
    id: 'partitura-e-cifra',
    label: 'Partitura e Cifra',
    description: 'Gere partitura PDF, MusicXML e letra cifrada a partir do áudio.',
    path: '/transcricao-musical',
    defaultCta: 'Gerar partitura e cifra',
  },
  {
    id: 'distribuicao-digital',
    label: 'Distribuição digital',
    description: 'Envie sua música para Spotify, Apple Music, TikTok, YouTube e outras plataformas.',
    path: '/distribuicao-digital',
    defaultCta: 'Conhecer a distribuição digital',
  },
  {
    id: 'cadastro',
    label: 'Cadastro de compositor',
    description: 'Crie sua conta para usar o Studio IA e as ferramentas da área do compositor.',
    path: '/compositores/cadastro',
    defaultCta: 'Criar conta de compositor',
  },
  {
    id: 'planos',
    label: 'Planos',
    description: 'Veja planos e créditos para criar músicas na DCC Music.',
    path: '/compositores/planos',
    defaultCta: 'Ver planos da DCC Music',
  },
  {
    id: 'compositores',
    label: 'Compositores',
    description: 'Conheça compositores e o catálogo público da DCC Music.',
    path: '/compositores',
    defaultCta: 'Ver compositores',
  },
]

export function getBlogProduct(id: string) {
  return blogProducts.find((product) => product.id === id)
}
