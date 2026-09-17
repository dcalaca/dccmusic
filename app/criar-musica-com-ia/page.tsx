import type { Metadata } from 'next'
import SeoAiLandingPage from '@/components/SeoAiLandingPage'

export const metadata: Metadata = {
  title: 'Criar Música com IA Online | DCC Music',
  description: 'Crie música com inteligência artificial a partir de uma ideia ou letra. Escolha o estilo, gere sua música online e experimente a primeira criação grátis.',
  alternates: { canonical: '/criar-musica-com-ia' },
  openGraph: {
    title: 'Criar Música com IA Online | DCC Music',
    description: 'Transforme uma ideia ou letra em música com inteligência artificial no Studio IA da DCC Music.',
    url: 'https://www.dccmusic.online/criar-musica-com-ia',
    type: 'website',
  },
}

export default function Page() {
  return (
    <SeoAiLandingPage
      eyebrow="Criar música com IA"
      title="Crie sua música com inteligência artificial"
      description="Digite sua ideia ou letra, escolha o estilo e transforme seu texto em uma música completa no Studio IA da DCC Music."
      intro="Você não precisa começar com uma produção pronta. Escreva o tema, a história ou a letra que quer cantar e use a IA para desenvolver uma versão musical com voz e instrumental. Depois, você pode continuar trabalhando no projeto dentro do Studio IA."
      benefits={[
        'Criar música a partir de uma ideia, tema ou letra.',
        'Escolher estilos e direcionar o resultado musical.',
        'Gerar versões para comparar antes de decidir qual seguir.',
        'Manter suas criações organizadas no seu projeto.',
      ]}
      steps={[
        'Cadastre-se ou entre na sua conta.',
        'Escreva a ideia da música ou cole sua letra.',
        'Escolha o estilo e as preferências da criação.',
        'Gere sua música e ouça o resultado.',
      ]}
      faq={[
        { question: 'Preciso saber produzir música?', answer: 'Não. A proposta do Studio IA é permitir que você comece pela ideia ou pela letra e use a inteligência artificial para gerar a música.' },
        { question: 'Posso usar uma letra que eu já escrevi?', answer: 'Sim. Você pode partir de uma letra própria e usá-la como base da criação.' },
        { question: 'Dá para escolher o estilo musical?', answer: 'Sim. O Studio IA permite direcionar o gênero e outras preferências disponíveis no fluxo de criação.' },
        { question: 'Tem como experimentar antes?', answer: 'Sim. O cadastro permite experimentar a primeira criação grátis.' },
      ]}
    />
  )
}
