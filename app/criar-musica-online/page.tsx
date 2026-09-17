import type { Metadata } from 'next'
import SeoAiLandingPage from '@/components/SeoAiLandingPage'

export const metadata: Metadata = {
  title: 'Criar Música Online com IA | DCC Music',
  description: 'Crie música online com inteligência artificial usando sua ideia ou letra. Use o Studio IA da DCC Music direto no navegador.',
  alternates: { canonical: '/criar-musica-online' },
  openGraph: {
    title: 'Criar Música Online com IA | DCC Music',
    description: 'Crie música online a partir de uma ideia ou letra usando inteligência artificial.',
    url: 'https://www.dccmusic.online/criar-musica-online',
    type: 'website',
  },
}

export default function Page() {
  return (
    <SeoAiLandingPage
      eyebrow="Criar música online"
      title="Crie música online direto pelo navegador"
      description="Transforme uma ideia ou letra em música com inteligência artificial sem instalar programa no computador."
      intro="O Studio IA funciona online e concentra o processo de criação no navegador. Você informa o que quer criar, define as preferências disponíveis e recebe versões para ouvir e continuar trabalhando."
      benefits={[
        'Criar música online pelo navegador.',
        'Usar uma ideia, tema ou letra como ponto de partida.',
        'Direcionar o estilo musical da criação.',
        'Manter as versões dentro do seu projeto na DCC Music.',
      ]}
      steps={[
        'Acesse o Studio IA pelo navegador.',
        'Digite sua ideia ou cole sua letra.',
        'Escolha as preferências da música.',
        'Gere, ouça e continue seu projeto.',
      ]}
      faq={[
        { question: 'Preciso baixar algum programa?', answer: 'Não. A criação acontece online pelo navegador.' },
        { question: 'Posso usar no celular?', answer: 'Sim. O acesso é feito pela web em dispositivos compatíveis.' },
        { question: 'Posso transformar texto em música?', answer: 'Sim. Você pode descrever a ideia da música ou fornecer uma letra como base da criação.' },
        { question: 'É possível testar antes de comprar?', answer: 'Sim. O cadastro permite experimentar a primeira criação grátis.' },
      ]}
    />
  )
}
