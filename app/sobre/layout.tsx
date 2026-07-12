import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre Nós',
  description:
    'Conheça o DCC Music: Studio IA para criar músicas com inteligência artificial, Partitura e Cifra para transcrição musical e ferramentas para compositores divulgarem obras.',
  keywords: [
    'sobre DCC Music',
    'Studio IA',
    'partitura e cifra',
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
    title: 'Sobre Nós - DCC Music',
    description:
      'Conheça o DCC Music, o Studio IA, Partitura e Cifra e as ferramentas para compositores criarem, organizarem e divulgarem músicas.',
    type: 'website',
  },
}

export default function SobreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
