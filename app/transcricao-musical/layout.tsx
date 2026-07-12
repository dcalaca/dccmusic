import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partitura e Cifra - Transcrição Musical',
  description:
    'Transforme áudio em partitura PDF, MusicXML e letra cifrada. Use uma música do Studio IA ou envie seu áudio. Preço: R$ 6,90 por música (25 créditos).',
  keywords: [
    'partitura e cifra',
    'transcrição musical',
    'MusicXML',
    'letra cifrada',
    'partitura PDF',
    'cifra de música',
    'DCC Music',
    'Studio IA',
    'gerar cifra',
    'partitura online',
  ],
  alternates: {
    canonical: '/transcricao-musical',
  },
  openGraph: {
    title: 'Partitura e Cifra | DCC Music',
    description:
      'Gere partitura, cifra, MusicXML e letra cifrada a partir do áudio da sua música. Ideal para estudar, tocar e imprimir.',
    url: 'https://www.dccmusic.online/transcricao-musical',
    type: 'website',
  },
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Partitura e Cifra DCC Music',
  description:
    'Serviço de transcrição musical que gera partitura PDF, MusicXML e letra cifrada a partir de músicas do Studio IA ou upload de áudio.',
  provider: {
    '@type': 'Organization',
    name: 'DCC Music',
    url: 'https://www.dccmusic.online',
  },
  areaServed: 'BR',
  offers: {
    '@type': 'Offer',
    price: '6.90',
    priceCurrency: 'BRL',
    description: '25 créditos do saldo DCC por transcrição musical',
  },
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
