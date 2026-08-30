import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'O que é o DCC Music? | Música com IA e Cifras',
  description:
    'DCC Music é uma plataforma brasileira para criar músicas com inteligência artificial, gerar cifras, organizar projetos e divulgar obras de compositores.',
  keywords: [
    'o que é DCC Music',
    'sobre DCC Music',
    'Studio IA',
    'cifra da música',
    'música com inteligência artificial',
    'compositores',
    'criação musical',
    'projetos musicais',
    'divulgação musical',
  ],
  alternates: {
    canonical: '/sobre',
  },
  openGraph: {
    title: 'O que é o DCC Music? | Plataforma de música com IA',
    description:
      'DCC Music é uma plataforma brasileira que reúne Studio IA, Cifras, projetos musicais e ferramentas para compositores criarem e divulgarem obras.',
    url: 'https://www.dccmusic.online/sobre',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'O que é o DCC Music?',
    description:
      'Plataforma brasileira para criar músicas com IA, gerar cifras, organizar projetos e divulgar obras.',
  },
}

export default function SobreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
