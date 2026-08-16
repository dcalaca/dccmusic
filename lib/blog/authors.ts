import type { BlogAuthor } from './types'

export const blogAuthors: BlogAuthor[] = [
  {
    slug: 'dcc-music',
    name: 'DCC Music',
    role: 'Equipe editorial',
    bio: 'A DCC Music é uma plataforma brasileira para criar músicas com inteligência artificial, gerar partitura e cifra, distribuir obras e divulgar o trabalho de compositores.',
    image: '/logopng.png',
    imageAlt: 'Logo da DCC Music',
    sameAs: [
      'https://www.dccmusic.online',
      'https://www.instagram.com/dccmusic.online/',
      'https://www.youtube.com/@dcalaca',
    ],
  },
]

export function getBlogAuthor(slug: string) {
  return blogAuthors.find((author) => author.slug === slug) || blogAuthors[0]
}
