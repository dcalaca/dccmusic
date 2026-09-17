import type { Metadata } from 'next'
import SeoAiLandingPage from '@/components/SeoAiLandingPage'

export const metadata: Metadata = {
  title: 'Criar Música Grátis com IA | DCC Music',
  description: 'Crie música grátis com IA a partir de uma ideia ou letra. Cadastre-se na DCC Music e experimente sua primeira criação no Studio IA.',
  alternates: { canonical: '/criar-musica-gratis' },
  openGraph: {
    title: 'Criar Música Grátis com IA | DCC Music',
    description: 'Experimente criar sua primeira música com inteligência artificial na DCC Music.',
    url: 'https://www.dccmusic.online/criar-musica-gratis',
    type: 'website',
  },
}

export default function Page() {
  return (
    <SeoAiLandingPage
      eyebrow="Criar música grátis"
      title="Crie sua primeira música com IA grátis"
      description="Cadastre-se, escreva sua ideia ou letra e experimente sua primeira criação no Studio IA da DCC Music."
      intro="Se você quer testar como uma ideia vira música antes de seguir com novas criações, pode começar pelo cadastro e experimentar a primeira criação grátis. O fluxo acontece online e foi pensado para ser simples."
      benefits={[
        'Começar pela sua própria ideia ou letra.',
        'Experimentar a primeira criação grátis após o cadastro.',
        'Escolher o estilo da música no Studio IA.',
        'Ouvir o resultado online e continuar pelo seu projeto.',
      ]}
      steps={[
        'Faça seu cadastro grátis.',
        'Entre no Studio IA.',
        'Escreva a ideia ou cole sua letra.',
        'Gere e ouça sua primeira criação.',
      ]}
      faq={[
        { question: 'A primeira criação é grátis?', answer: 'Sim. Após o cadastro, você pode experimentar a primeira criação grátis no Studio IA.' },
        { question: 'Preciso colocar cartão para começar?', answer: 'O cadastro é gratuito. As opções de compra aparecem quando você quiser continuar criando além da experiência inicial.' },
        { question: 'Posso criar com uma letra minha?', answer: 'Sim. Você pode colar uma letra própria e usá-la como base da música.' },
        { question: 'Funciona no celular?', answer: 'Sim. O Studio IA é acessado pelo navegador e pode ser usado em dispositivos compatíveis.' },
      ]}
    />
  )
}
