'use client'

import { useState } from 'react'
import { FiHelpCircle, FiChevronDown, FiCopy, FiCheck } from 'react-icons/fi'
import { useLocalization } from '@/components/LocalizationProvider'
import { faqsEsPy } from '@/lib/faq-es-py'
import { faqsPtBr } from '@/lib/faq-pt-br'
import { faqsPtPt } from '@/lib/faq-pt-pt'

export default function FAQPage() {
  const { country } = useLocalization()
  const isPortugal = country === 'PT'
  const isSpanish = country === 'PY' || country === 'CO'
  const localizedFaqs = isPortugal ? faqsPtPt : isSpanish ? faqsEsPy : faqsPtBr

  const title = isPortugal
    ? 'Perguntas frequentes'
    : isSpanish
      ? 'Preguntas frecuentes'
      : 'Perguntas Frequentes'

  const subtitle = isPortugal
    ? 'Esclareça as suas dúvidas sobre o DCC Music, Studio IA, Partitura e Cifra, créditos, projetos e apoio.'
    : isSpanish
      ? 'Resuelve tus dudas sobre DCC Music, Studio IA, Partitura y Cifrado, créditos, proyectos y soporte.'
      : 'Tire dúvidas sobre DCC Music, Studio IA, Partitura e Cifra, créditos, projetos e suporte.'

  const supportTitle = isPortugal
    ? 'Não encontrou o que procurava?'
    : isSpanish
      ? '¿No encontraste lo que buscabas?'
      : 'Não encontrou o que procurava?'

  const supportText = isPortugal
    ? 'Contacte o apoio e indique o e-mail associado à sua conta. Se a questão for sobre o Studio IA ou Partitura e Cifra, envie também o código do projeto.'
    : isSpanish
      ? 'Comunícate con soporte e informa el correo de tu cuenta. Si la consulta es sobre Studio IA o Partitura y Cifrado, envía también el código del proyecto.'
      : 'Fale com o suporte e informe seu email de cadastro. Se for sobre uma música do Studio IA ou Partitura e Cifra, envie também o código do projeto.'

  const showEmailLabel = isPortugal ? 'Ver e-mail' : isSpanish ? 'Ver correo' : 'Ver Email'
  const copyEmailLabel = isPortugal ? 'Copiar e-mail' : isSpanish ? 'Copiar correo' : 'Copiar email'

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: localizedFaqs.flatMap((category) =>
      category.questions.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      }))
    ),
  }

  const [showEmail, setShowEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const email = 'suporte@dccmusic.online'

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
              <span className="gradient-text">{title}</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-400">{subtitle}</p>
          </div>

          <div className="mx-auto max-w-4xl space-y-8">
            {localizedFaqs.map((category, categoryIndex) => (
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
            <h2 className="mb-4 text-2xl font-bold">{supportTitle}</h2>
            <p className="mb-6 text-gray-300">{supportText}</p>
            {!showEmail ? (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-medium transition-all hover:from-primary-700 hover:to-purple-700"
              >
                {showEmailLabel}
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <span className="break-all text-xl font-semibold text-white">{email}</span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-800 px-4 py-2 transition-colors hover:bg-gray-700"
                  title={copyEmailLabel}
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
