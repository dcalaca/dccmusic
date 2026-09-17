import type { Metadata } from 'next'
import SeoAiLandingPage from '@/components/SeoAiLandingPage'

export const metadata: Metadata = {
  title: 'Gerador de Música IA Online | DCC Music',
  description: 'Use um gerador de música com IA para transformar texto ou letra em música. Crie online no Studio IA da DCC Music e experimente a primeira criação grátis.',
  alternates: { canonical: '/gerador-de-musica-ia' },
  openGraph: {
    title: 'Gerador de Música IA Online | DCC Music',
    description: 'Gere música com inteligência artificial a partir de uma ideia ou letra.',
    url: 'https://www.dccmusic.online/gerador-de-musica-ia',
    type: 'website',
  },
}

export default function Page() {
  return (
    <SeoAiLandingPage
      eyebrow="Gerador de música IA"
      title="Gerador de música com inteligência artificial"
      description="Use o Studio IA da DCC Music para transformar uma ideia, texto ou letra em uma música com voz e instrumental."
      intro="O gerador de música IA ajuda a sair do texto e chegar a uma versão musical completa. Você descreve o que quer, orienta o estilo e recebe versões para ouvir e comparar."
      benefits={[
        'Gerar música a partir de texto, tema ou letra.',
        'Direcionar o estilo musical da criação.',
        'Ouvir versões diferentes antes de escolher.',
        'Criar online, sem instalar programa no computador.',
      ]}
      steps={[
        'Abra o Studio IA.',
        'Informe sua ideia ou letra.',
        'Defina as preferências da música.',
        'Gere e ouça as versões criadas.',
      ]}
      faq={[
        { question: 'O que é um gerador de música IA?', answer: 'É uma ferramenta que usa inteligência artificial para criar uma música a partir de instruções como tema, letra e estilo.' },
        { question: 'Posso começar só com uma ideia?', answer: 'Sim. Você pode descrever o assunto ou conceito da música e usar isso como ponto de partida.' },
        { question: 'Também posso usar minha própria letra?', answer: 'Sim. Se você já tem a letra, pode usá-la como base da geração.' },
        { question: 'Preciso instalar alguma coisa?', answer: 'Não. O Studio IA funciona online pelo navegador.' },
      ]}
    />
  )
}
