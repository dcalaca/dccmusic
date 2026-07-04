'use client'

import { useState } from 'react'
import { FiHelpCircle, FiChevronDown, FiCopy, FiCheck } from 'react-icons/fi'

const faqs = [
  {
    category: 'DCC Music',
    questions: [
      {
        question: 'O que é o DCC Music?',
        answer: 'O DCC Music é uma plataforma para divulgar músicas, vídeos, compositores e também criar músicas com inteligência artificial pelo Studio IA.',
      },
      {
        question: 'Preciso pagar para acessar o site?',
        answer: 'Não. As páginas públicas com músicas, vídeos, compositores e informações do DCC Music podem ser acessadas gratuitamente.',
      },
      {
        question: 'Posso ouvir músicas e assistir vídeos pelo celular?',
        answer: 'Sim. O site funciona no celular, tablet e computador. Para melhor experiência, use um navegador atualizado, como Chrome, Edge, Safari ou Firefox.',
      },
    ],
  },
  {
    category: 'Área do Compositor',
    questions: [
      {
        question: 'Como faço para me cadastrar como compositor?',
        answer: 'Acesse a página de cadastro de compositores, preencha seus dados e crie sua conta. Depois disso, você poderá entrar na área do compositor para gerenciar suas músicas, vídeos e dados.',
      },
      {
        question: 'O que consigo fazer na área do compositor?',
        answer: 'Você consegue atualizar seus dados, cadastrar músicas, cadastrar vídeos, acompanhar suas criações no Studio IA, comprar créditos e acessar recursos disponíveis no seu plano.',
      },
      {
        question: 'Esqueci minha senha. O que faço?',
        answer: 'Na tela de login do compositor, clique na opção de recuperar senha e siga as instruções. Se continuar com dificuldade, entre em contato com o suporte.',
      },
      {
        question: 'Como atualizo meus dados?',
        answer: 'Depois de entrar na sua conta, acesse "Meus dados" na área do compositor. Ali você pode revisar e atualizar suas informações cadastrais.',
      },
    ],
  },
  {
    category: 'Studio IA',
    questions: [
      {
        question: 'O que é o Studio IA?',
        answer: 'O Studio IA é a ferramenta do DCC Music para criar músicas com inteligência artificial. Você informa o nome, estilo, clima e ideia da música, e o sistema ajuda a criar letra, arranjo e áudio.',
      },
      {
        question: 'A IA cria a letra também?',
        answer: 'Sim. Você pode pedir para a IA gerar uma letra do zero, melhorar uma letra existente ou completar uma ideia que você já começou.',
      },
      {
        question: 'Posso enviar uma música pronta para melhorar?',
        answer: 'Sim. Na opção de melhorar música, você pode enviar um áudio pronto para a IA usar como referência e gerar uma nova produção.',
      },
      {
        question: 'Posso gravar minha voz direto no site?',
        answer: 'Sim. Você pode gravar pelo próprio navegador, cantar um trecho ou uma ideia, conferir a letra transcrita e pedir para a IA completar ou produzir a música usando sua gravação como referência.',
      },
      {
        question: 'Qual é o limite de duração das músicas criadas?',
        answer: 'As músicas criadas pelo Studio IA são orientadas para ter no máximo 4 minutos e 30 segundos. Esse limite ajuda a evitar áudios longos demais ou repetidos.',
      },
      {
        question: 'Quando o sistema gera duas versões, eu posso escolher uma?',
        answer: 'Sim. Quando houver mais de uma versão no projeto, você pode ouvir as opções e escolher qual delas quer usar como inspiração para uma nova criação.',
      },
    ],
  },
  {
    category: 'Créditos e Pagamentos',
    questions: [
      {
        question: 'Como funcionam os créditos do Studio IA?',
        answer: 'Cada criação de música no Studio IA consome créditos. Os créditos podem vir do seu plano, de recargas avulsas ou de regras promocionais disponíveis no momento.',
      },
      {
        question: 'Consigo comprar músicas avulsas?',
        answer: 'Sim. Você pode comprar créditos avulsos para criar músicas sem depender apenas de um plano mensal. Quanto maior o pacote, melhor pode ser o valor por música.',
      },
      {
        question: 'Onde vejo o que foi descontado?',
        answer: 'Na área do Studio IA, você pode acompanhar seus créditos e o uso das criações. Em caso de dúvida sobre um projeto específico, copie o código do projeto e envie para o suporte.',
      },
      {
        question: 'A compra é liberada na hora?',
        answer: 'Normalmente a liberação acontece automaticamente após a confirmação do pagamento. Se o pagamento foi aprovado e os créditos não apareceram, fale com o suporte informando seu email de cadastro.',
      },
    ],
  },
  {
    category: 'Projetos, Músicas e Suporte',
    questions: [
      {
        question: 'Onde ficam minhas músicas criadas pela IA?',
        answer: 'As músicas criadas ficam em "Meus Projetos", dentro da área do Studio IA. Cada projeto pode ter letra, capa, versões geradas e histórico de criação.',
      },
      {
        question: 'Posso compartilhar uma música ou vídeo?',
        answer: 'Sim. As páginas públicas de músicas e vídeos podem ser compartilhadas por link. Na área do compositor, use os botões e links disponíveis para acessar ou divulgar seu conteúdo.',
      },
      {
        question: 'Como encontro uma música por estilo?',
        answer: 'Nas páginas públicas de músicas e vídeos, use os filtros disponíveis para procurar por gênero, compositor ou conteúdo.',
      },
      {
        question: 'Como peço ajuda sobre um projeto específico?',
        answer: 'Abra o projeto no Studio IA, copie o código do projeto e envie para o suporte junto com sua dúvida. Isso ajuda a localizar exatamente a música ou criação que você está falando.',
      },
      {
        question: 'Como reporto erro ou problema no site?',
        answer: 'Entre em contato pelo email suporte@dccmusic.online. Se possível, envie seu email de cadastro, o código do projeto e uma descrição simples do que aconteceu.',
      },
    ],
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap(category =>
    category.questions.map(faq => ({
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
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-600 to-purple-600 rounded-full mb-4">
            <FiHelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Perguntas Frequentes</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Tire dúvidas sobre compositores, Studio IA, créditos, projetos e suporte.
          </p>
        </div>

        {/* FAQ Content */}
        <div className="max-w-4xl mx-auto space-y-8">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-primary-400">
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((faq, faqIndex) => (
                  <details
                    key={faqIndex}
                    className="group bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-primary-500 transition-colors"
                  >
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <h3 className="font-semibold text-white pr-4">{faq.question}</h3>
                      <FiChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                    </summary>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="max-w-4xl mx-auto mt-12 bg-gradient-to-r from-primary-600/20 to-purple-600/20 border border-primary-500/30 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Não encontrou o que procurava?</h2>
          <p className="text-gray-300 mb-6">
            Fale com o suporte e informe seu email de cadastro. Se for sobre uma música do Studio IA, envie também o código do projeto.
          </p>
          {!showEmail ? (
            <button
              type="button"
              onClick={handleEmailClick}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
            >
              Ver Email
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="text-xl font-semibold text-white break-all">{email}</span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                title="Copiar email"
              >
                {copied ? (
                  <FiCheck className="w-5 h-5 text-green-400" />
                ) : (
                  <FiCopy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
