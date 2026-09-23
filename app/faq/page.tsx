'use client'

import { useState } from 'react'
import { FiHelpCircle, FiChevronDown, FiCopy, FiCheck } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

type FaqCategory = { category: string; questions: { question: string; answer: string }[] }

export default function FAQPage() {
  const { t } = useTranslation()
  const localizedFaqs = t('faqPage.sections', { returnObjects: true }) as unknown as FaqCategory[]

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
              <span className="gradient-text">{t('faqPage.title')}</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-400">{t('faqPage.subtitle')}</p>
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
            <h2 className="mb-4 text-2xl font-bold">{t('faqPage.supportTitle')}</h2>
            <p className="mb-6 text-gray-300">{t('faqPage.supportText')}</p>
            {!showEmail ? (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-medium transition-all hover:from-primary-700 hover:to-purple-700"
              >
                {t('faqPage.showEmail')}
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <span className="break-all text-xl font-semibold text-white">{email}</span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-800 px-4 py-2 transition-colors hover:bg-gray-700"
                  title={t('faqPage.copyEmail')} aria-label={t('faqPage.copyEmail')}
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
