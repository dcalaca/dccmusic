import type { BlogCategory, BlogCluster, BlogTag } from './types'

export const blogCategories: BlogCategory[] = [
  {
    slug: 'plataforma',
    title: 'DCC Music',
    description: 'O que é a DCC Music, como a plataforma funciona e como ela se relaciona com composição, produção e divulgação musical.',
    seoTitle: 'DCC Music: plataforma, ferramentas e conteúdo',
    seoDescription:
      'Entenda o que é a DCC Music, o que a plataforma oferece e como ela ajuda compositores a criar, transcrever e divulgar músicas.',
  },
  {
    slug: 'studio-ia',
    title: 'Studio IA',
    description: 'Criação de músicas com inteligência artificial: letras, áudio, capas, versões e projetos no Studio IA da DCC Music.',
    seoTitle: 'Studio IA: criar música com inteligência artificial',
    seoDescription:
      'Conteúdo sobre o Studio IA da DCC Music: como criar letra, música completa, capa e versões com inteligência artificial.',
  },
  {
    slug: 'partitura-e-cifra',
    title: 'Partitura e Cifra',
    description: 'Transcrição musical em partitura PDF, MusicXML e letra cifrada a partir de áudio.',
    seoTitle: 'Partitura e cifra: transcrição musical',
    seoDescription:
      'Artigos sobre partitura, cifra, MusicXML e transcrição musical com as ferramentas da DCC Music.',
  },
  {
    slug: 'composicao-e-letras',
    title: 'Composição e letras',
    description: 'Composição, letras, estrutura de canção e o uso de inteligência artificial no processo criativo.',
    seoTitle: 'Composição e letras musicais',
    seoDescription: 'Conteúdo sobre composição, letras e criação musical para compositores e artistas independentes.',
  },
  {
    slug: 'producao-musical',
    title: 'Produção musical',
    description: 'Produção, arranjo, voz, instrumental e organização de projetos musicais.',
    seoTitle: 'Produção musical para compositores',
    seoDescription: 'Artigos sobre produção musical, arranjo, versões e o fluxo de criação na DCC Music.',
  },
  {
    slug: 'distribuicao-digital',
    title: 'Distribuição digital',
    description: 'Como distribuir músicas em Spotify, Apple Music, TikTok, YouTube e outras plataformas.',
    seoTitle: 'Distribuição digital de músicas',
    seoDescription:
      'Conteúdo sobre distribuição digital, streaming e divulgação de músicas para compositores independentes.',
  },
]

export const blogTags: BlogTag[] = [
  { slug: 'inteligencia-artificial', title: 'Inteligência artificial', description: 'IA aplicada à criação e produção musical.' },
  { slug: 'criar-musica', title: 'Criar música', description: 'Como transformar ideia, letra ou áudio em uma música pronta.' },
  { slug: 'letra', title: 'Letra', description: 'Escrita, revisão e geração de letras musicais.' },
  { slug: 'compositor', title: 'Compositor', description: 'Ferramentas e processos para compositores.' },
  { slug: 'partitura', title: 'Partitura', description: 'Partitura PDF e leitura musical.' },
  { slug: 'cifra', title: 'Cifra', description: 'Letra cifrada e acompanhamento harmônico.' },
  { slug: 'musicxml', title: 'MusicXML', description: 'Arquivos MusicXML para edição em softwares de partitura.' },
  { slug: 'producao', title: 'Produção', description: 'Produção musical, arranjo e versões.' },
  { slug: 'distribuicao', title: 'Distribuição', description: 'Distribuição em plataformas de streaming.' },
  { slug: 'studio-ia', title: 'Studio IA', description: 'A ferramenta de criação musical com IA da DCC Music.' },
]

export const blogClusters: BlogCluster[] = [
  {
    slug: 'plataforma-dcc-music',
    title: 'O que é a DCC Music',
    description: 'A plataforma, os produtos e o contexto de criação musical com inteligência artificial.',
    pillarSlug: 'o-que-e-dcc-music',
  },
  {
    slug: 'criar-musica-com-ia',
    title: 'Criar música com inteligência artificial',
    description: 'Do tema e da letra até o áudio pronto no Studio IA.',
    pillarSlug: 'o-que-e-o-studio-ia',
  },
  {
    slug: 'transcricao-musical',
    title: 'Partitura, cifra e transcrição',
    description: 'Como transformar áudio em partitura, MusicXML e letra cifrada.',
    pillarSlug: 'o-que-e-partitura-e-cifra',
  },
  {
    slug: 'composicao-e-letras',
    title: 'Composição e letras',
    description: 'Tema, estrutura de canção e o uso da IA para escrever letras.',
    pillarSlug: 'o-que-e-composicao-e-letras',
  },
  {
    slug: 'producao-musical',
    title: 'Produção musical',
    description: 'Voz, instrumental, versões e organização de projetos no Studio IA.',
    pillarSlug: 'o-que-e-producao-musical',
  },
  {
    slug: 'distribuicao-digital',
    title: 'Distribuição digital',
    description: 'Como enviar músicas para Spotify, Apple Music, TikTok e outras plataformas.',
    pillarSlug: 'o-que-e-distribuicao-digital',
  },
]

export function getBlogCategory(slug: string) {
  return blogCategories.find((category) => category.slug === slug)
}

export function getBlogTag(slug: string) {
  return blogTags.find((tag) => tag.slug === slug)
}

export function getBlogCluster(slug?: string) {
  if (!slug) return undefined
  return blogClusters.find((cluster) => cluster.slug === slug)
}
