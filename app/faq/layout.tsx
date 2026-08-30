import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - Perguntas Frequentes',
  description:
    'Tire dúvidas sobre DCC Music, Studio IA, Cifra da Música, créditos, projetos e suporte ao compositor.',
  keywords: [
    'FAQ DCC Music',
    'perguntas frequentes',
    'Studio IA',
    'cifra da música',
    'créditos compositor',
    'música com IA',
  ],
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'FAQ - Perguntas Frequentes | DCC Music',
    description:
      'Dúvidas sobre compositores, Studio IA, Cifra da Música, créditos, projetos e suporte.',
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
