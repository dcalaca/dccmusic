import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - Perguntas Frequentes',
  description:
    'Tire dúvidas sobre DCC Music, Studio IA, Partitura e Cifra, créditos, MusicXML, letra cifrada, projetos e suporte ao compositor.',
  keywords: [
    'FAQ DCC Music',
    'perguntas frequentes',
    'Studio IA',
    'partitura e cifra',
    'transcrição musical',
    'MusicXML',
    'créditos compositor',
    'música com IA',
  ],
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'FAQ - Perguntas Frequentes | DCC Music',
    description:
      'Dúvidas sobre compositores, Studio IA, Partitura e Cifra, créditos, projetos e suporte.',
    type: 'website',
  },
}

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
