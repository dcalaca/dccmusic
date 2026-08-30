import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cifra da Música',
  description:
    'Gere uma cifra limpa com letra e acordes para tocar, imprimir e compartilhar. Custa 10 créditos por música.',
  keywords: [
    'cifra de música',
    'letra cifrada',
    'DCC Music',
    'Studio IA',
    'gerar cifra',
    'cifra online',
  ],
  alternates: {
    canonical: '/transcricao-musical',
  },
  openGraph: {
    title: 'Cifra da Música | DCC Music',
    description:
      'Gere uma cifra limpa com letra e acordes para tocar e imprimir.',
    url: 'https://www.dccmusic.online/transcricao-musical',
    type: 'website',
  },
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Cifra da Música DCC Music',
  description:
    'Serviço da DCC Music que gera cifra em PDF com letra e acordes para músicas do Studio IA.',
  provider: {
    '@type': 'Organization',
    name: 'DCC Music',
    url: 'https://www.dccmusic.online',
  },
  areaServed: 'BR',
}

export default function TranscricaoMusicalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      {children}
    </>
  )
}
