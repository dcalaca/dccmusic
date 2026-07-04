import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - Perguntas Frequentes',
  description: 'Tire dúvidas sobre o DCC Music, área do compositor, Studio IA, créditos, gravação de voz, projetos e suporte.',
  keywords: 'FAQ, perguntas frequentes, DCC Music, Studio IA, compositor, créditos, suporte, músicas com IA',
  openGraph: {
    title: 'FAQ - Perguntas Frequentes | DCC Music',
    description: 'Tire dúvidas sobre compositores, Studio IA, créditos, projetos e suporte.',
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
