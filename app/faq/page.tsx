'use client'

import { useState } from 'react'
import { FiHelpCircle, FiChevronDown, FiCopy, FiCheck } from 'react-icons/fi'

const faqs = [
  {
    category: 'DCC Music',
    questions: [
      {
        question: 'O que é o DCC Music?',
        answer:
          'O DCC Music é uma plataforma brasileira para ouvir músicas e vídeos, conhecer compositores e criar produções com inteligência artificial. Além do catálogo público, compositores logados têm acesso ao Studio IA (criação de músicas), Partitura e Cifra (transcrição em partitura, MusicXML e letra cifrada) e ferramentas de divulgação.',
      },
      {
        question: 'Preciso pagar para acessar o site?',
        answer:
          'Não. As páginas públicas com músicas, vídeos, compositores e informações do DCC Music podem ser acessadas gratuitamente. Recursos como Studio IA e Partitura e Cifra usam créditos do compositor.',
      },
      {
        question: 'Posso ouvir músicas e assistir vídeos pelo celular?',
        answer:
          'Sim. O site funciona no celular, tablet e computador. Para melhor experiência, use um navegador atualizado, como Chrome, Edge, Safari ou Firefox.',
      },
    ],
  },
  {
    category: 'Área do Compositor',
    questions: [
      {
        question: 'Como faço para me cadastrar como compositor?',
        answer:
          'Acesse a página de cadastro de compositores, preencha seus dados e crie sua conta. Depois disso, você poderá entrar na área do compositor para gerenciar músicas, vídeos, projetos do Studio IA, créditos e extrato.',
      },
      {
        question: 'O que consigo fazer na área do compositor?',
        answer:
          'Você consegue criar músicas no Studio IA, gerar partitura e cifra, cadastrar músicas e vídeos, acompanhar projetos em Meus Projetos, comprar créditos, ver Conta e extrato e usar recursos disponíveis no seu plano.',
      },
      {
        question: 'Esqueci minha senha. O que faço?',
        answer:
          'Na tela de login do compositor, clique na opção de recuperar senha e siga as instruções. Se continuar com dificuldade, entre em contato com o suporte.',
      },
      {
        question: 'Onde vejo meu saldo e extrato de créditos?',
        answer:
          'Depois de entrar na sua conta, clique no seu nome no topo do site e escolha Conta e extrato. Lá você acompanha saldo, movimentações e histórico de uso, incluindo criações no Studio IA e Partitura e Cifra.',
      },
    ],
  },
  {
    category: 'Studio IA',
    questions: [
      {
        question: 'O que é o Studio IA?',
        answer:
          'O Studio IA é a ferramenta do DCC Music para criar músicas com inteligência artificial. Você informa o nome, estilo, clima e ideia da música, e o sistema ajuda a criar letra, arranjo, áudio e capa.',
      },
      {
        question: 'A IA cria a letra também?',
        answer:
          'Sim. Você pode pedir para a IA gerar uma letra do zero, melhorar uma letra existente ou completar uma ideia que você já começou.',
      },
      {
        question: 'Posso enviar uma música pronta para melhorar?',
        answer:
          'Sim. Na opção de melhorar música, você pode enviar um áudio pronto para a IA usar como referência e gerar uma nova produção.',
      },
      {
        question: 'Posso gravar minha voz direto no site?',
        answer:
          'Sim. Você pode gravar pelo próprio navegador, cantar um trecho ou uma ideia, conferir a letra transcrita e pedir para a IA completar ou produzir a música usando sua gravação como referência.',
      },
      {
        question: 'Posso usar minhas próprias vozes clonadas?',
        answer:
          'Sim. Em Minhas vozes, você pode cadastrar e validar vozes para usar nas criações do Studio IA, quando essa opção estiver disponível na sua conta.',
      },
      {
        question: 'Qual é o limite de duração das músicas criadas?',
        answer:
          'As músicas criadas pelo Studio IA são orientadas para ter no máximo 4 minutos e 30 segundos. Esse limite ajuda a evitar áudios longos demais ou repetidos.',
      },
      {
        question: 'Quando o sistema gera duas versões, eu posso escolher uma?',
        answer:
          'Sim. Quando houver mais de uma versão no projeto, você pode ouvir as opções e escolher qual delas quer usar como inspiração para uma nova criação ou para gerar partitura e cifra.',
      },
    ],
  },
  {
    category: 'Partitura e Cifra',
    questions: [
      {
        question: 'O que é Partitura e Cifra no DCC Music?',
        answer:
          'É o serviço que transforma o áudio de uma música em arquivos para estudar e tocar: partitura em PDF, MusicXML e letra cifrada. Você pode usar uma música criada no Studio IA ou enviar seu próprio áudio.',
      },
      {
        question: 'Quanto custa gerar partitura e cifra?',
        answer:
          'O preço exibido é de R$ 6,90 por música. Na prática, o sistema debita 25 créditos do seu saldo DCC a cada transcrição concluída com sucesso.',
      },
      {
        question: 'Quais arquivos eu recebo?',
        answer:
          'Você recebe partitura em PDF, arquivo MusicXML (para abrir em programas de notação) e PDF da letra cifrada. Também há prévia da cifra e letra direto na tela, com tom e BPM quando disponíveis.',
      },
      {
        question: 'Posso usar uma música que criei no Studio IA?',
        answer:
          'Sim. Na página Partitura e Cifra, escolha Música do Studio IA e selecione a música desejada. Se você vier direto de um projeto recém-criado, a plataforma tenta pré-selecionar essa música automaticamente.',
      },
      {
        question: 'Posso enviar um áudio meu, sem ser do Studio IA?',
        answer:
          'Sim. Use a opção Enviar áudio e mande um arquivo MP3, WAV, M4A, AAC, FLAC ou OGG de até 50 MB. Informe o nome da música e o sistema gera a transcrição.',
      },
      {
        question: 'Onde ficam salvas minhas partituras depois de gerar?',
        answer:
          'Os arquivos ficam salvos permanentemente na sua conta. Acesse Meus Projetos no Studio IA e use o filtro Partituras e Cifras para ver, baixar novamente e gerenciar tudo o que já foi gerado.',
      },
      {
        question: 'Se eu gerar de novo a mesma música, pago outra vez?',
        answer:
          'Não. Se a transcrição daquela música já foi concluída antes, o sistema reutiliza o resultado salvo e não desconta créditos novamente.',
      },
    ],
  },
  {
    category: 'Créditos e Pagamentos',
    questions: [
      {
        question: 'Como funcionam os créditos do Studio IA?',
        answer:
          'Cada criação de música no Studio IA consome créditos. A Partitura e Cifra consome 25 créditos por transcrição nova. Os créditos podem vir do seu plano, de recargas avulsas ou de regras promocionais disponíveis no momento.',
      },
      {
        question: 'Consigo comprar créditos avulsos?',
        answer:
          'Sim. Você pode comprar créditos avulsos para criar músicas e usar Partitura e Cifra sem depender apenas de um plano mensal. Quanto maior o pacote, melhor pode ser o valor por crédito.',
      },
      {
        question: 'Onde vejo o que foi descontado?',
        answer:
          'Em Conta e extrato, no menu do seu nome no topo do site. Lá aparecem criações no Studio IA, Partitura e cifra, recargas e outras movimentações. Se tiver dúvida sobre um projeto específico, copie o código do projeto e envie para o suporte.',
      },
      {
        question: 'A compra é liberada na hora?',
        answer:
          'Normalmente a liberação acontece automaticamente após a confirmação do pagamento. Se o pagamento foi aprovado e os créditos não apareceram, fale com o suporte informando seu email de cadastro.',
      },
    ],
  },
  {
    category: 'Projetos, Músicas e Suporte',
    questions: [
      {
        question: 'Onde ficam minhas músicas criadas pela IA?',
        answer:
          'As músicas criadas ficam em Meus Projetos, dentro da área do Studio IA. Cada projeto pode ter letra, capa, versões geradas e histórico de criação. As partituras e cifras geradas aparecem no filtro Partituras e Cifras.',
      },
      {
        question: 'Posso compartilhar uma música ou vídeo?',
        answer:
          'Sim. As páginas públicas de músicas e vídeos podem ser compartilhadas por link. No Studio IA, você também pode publicar a música no DCC Music e usar link público ou player incorporável.',
      },
      {
        question: 'Como encontro uma música por estilo?',
        answer:
          'Nas páginas públicas de músicas e vídeos, use os filtros disponíveis para procurar por gênero, compositor ou conteúdo.',
      },
      {
        question: 'Como peço ajuda sobre um projeto específico?',
        answer:
          'Abra o projeto no Studio IA, copie o código do projeto e envie para o suporte junto com sua dúvida. Isso ajuda a localizar exatamente a música ou criação que você está falando.',
      },
      {
        question: 'Como reporto erro ou problema no site?',
        answer:
          'Entre em contato pelo email suporte@dccmusic.online. Se possível, envie seu email de cadastro, o código do projeto e uma descrição simples do que aconteceu.',
      },
    ],
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap((category) =>
    category.questions.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    }))
  ),
}

export default function FAQPage() {
  const [showEmail, setShowEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const email = 'suporte@dccmusic.online'

  const handleEmailClick = () => {
    setShowEmail(true)
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar email:', err)
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-purple-600">
              <FiHelpCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">
              <span className="gradient-text">Perguntas Frequentes</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-400">
              Tire dúvidas sobre DCC Music, Studio IA, Partitura e Cifra, créditos, projetos e suporte.
            </p>
          </div>

          <div className="mx-auto max-w-4xl space-y-8">
            {faqs.map((category, categoryIndex) => (
              <div key={categoryIndex} className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
                <h2 className="mb-6 text-2xl font-bold text-primary-400">{category.category}</h2>
                <div className="space-y-4">
                  {category.questions.map((faq, faqIndex) => (
                    <details
                      key={faqIndex}
                      className="group rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-primary-500"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between">
                        <h3 className="pr-4 font-semibold text-white">{faq.question}</h3>
                        <FiChevronDown className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-4 border-t border-gray-700 pt-4">
                        <p className="leading-relaxed text-gray-300">{faq.answer}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-lg border border-primary-500/30 bg-gradient-to-r from-primary-600/20 to-purple-600/20 p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold">Não encontrou o que procurava?</h2>
            <p className="mb-6 text-gray-300">
              Fale com o suporte e informe seu email de cadastro. Se for sobre uma música do Studio IA ou Partitura e Cifra, envie também o código do projeto.
            </p>
            {!showEmail ? (
              <button
                type="button"
                onClick={handleEmailClick}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-medium transition-all hover:from-primary-700 hover:to-purple-700"
              >
                Ver Email
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <span className="break-all text-xl font-semibold text-white">{email}</span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-800 px-4 py-2 transition-colors hover:bg-gray-700"
                  title="Copiar email"
                >
                  {copied ? <FiCheck className="h-5 w-5 text-green-400" /> : <FiCopy className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
