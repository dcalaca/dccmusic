import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre Nós',
  description: 'Conheça o DCC Music, a plataforma para compositores criarem músicas com IA, organizarem projetos e divulgarem suas obras.',
  keywords: 'sobre DCC Music, Studio IA, música com inteligência artificial, compositores, criação musical, projetos musicais, divulgação musical',
  openGraph: {
    title: 'Sobre Nós - DCC Music',
    description: 'Conheça o DCC Music, o Studio IA e as ferramentas para compositores criarem, organizarem e divulgarem músicas.',
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
