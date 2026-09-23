'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { FiMusic, FiVideo, FiUsers, FiAward, FiHeart, FiCopy, FiCheck, FiZap, FiEdit3, FiShield, FiGlobe, FiFileText } from 'react-icons/fi'
import Image from 'next/image'

const featureIcons = [FiZap, FiFileText, FiEdit3, FiMusic, FiVideo, FiUsers, FiAward]

export default function SobrePage() {
  const { t } = useTranslation()
  const [showEmail, setShowEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const features = featureIcons.map((icon, index) => ({
    icon,
    title: t(`about.feature${index + 1}.title`),
    description: t(`about.feature${index + 1}.description`),
  }))
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'AboutPage', name: t('about.title'), description: t('about.schemaDescription'), publisher: { '@type': 'Organization', name: 'DCC Music', url: 'https://www.dccmusic.online' } }) }}
      />
      <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center mb-6">
            <Image
              src="/logopng.png"
              alt="DCC Music"
              width={200}
              height={80}
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">{t('about.title')}</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">{t('about.hero')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/studio-ia"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
            >
              <FiZap />
              {t('about.studioCta')}</Link>
            <Link
              href="/transcricao-musical"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-950/40 px-6 py-3 font-bold text-cyan-100 hover:border-cyan-500"
            >
              <FiFileText />
              {t('about.chords')}</Link>
            <Link
              href="/compositores"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-6 py-3 font-bold text-gray-100 hover:border-purple-500"
            >
              <FiUsers />
              {t('about.composersCta')}</Link>
          </div>
        </div>

        {/* História Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-primary-400">{t('about.whyTitle')}</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>{t('about.why1')}</p>
              <p>{t('about.why2')}</p>
              <p>{t('about.why3')}</p>
              <p>{t('about.why4')}</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <div className="overflow-hidden rounded-3xl border border-purple-700/50 bg-gradient-to-br from-purple-950/60 via-black to-gray-950 p-8 shadow-2xl shadow-purple-950/20">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-sm text-purple-100">
                  <FiZap />{t('about.studioBadge')}</span>
                <h2 className="text-3xl font-black sm:text-4xl">{t('about.studioTitle')}</h2>
                <p className="mt-4 leading-relaxed text-gray-300">{t('about.studio1')}</p>
                <p className="mt-3 leading-relaxed text-gray-300">{t('about.studio2')}</p>
                <Link
                  href="/studio-ia"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
                >{t('about.studioExplore')}<FiZap />
                </Link>
              </div>
              <div className="grid gap-3">
                {[
                  [t('about.studioItem1Title'), t('about.studioItem1Text')],
                  [t('about.studioItem2Title'), t('about.studioItem2Text')],
                  [t('about.studioItem3Title'), t('about.studioItem3Text')],
                  [t('about.studioItem4Title'), t('about.studioItem4Text')],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-gray-800 bg-black/45 p-4">
                    <h3 className="font-bold text-white">{title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <div className="overflow-hidden rounded-3xl border border-cyan-700/50 bg-gradient-to-br from-cyan-950/50 via-black to-gray-950 p-8 shadow-2xl shadow-cyan-950/20">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-950/50 px-4 py-2 text-sm text-cyan-100">
                  <FiFileText />
              {t('about.chords')}</span>
                <h2 className="text-3xl font-black sm:text-4xl">{t('about.chordsTitle')}</h2>
                <p className="mt-4 leading-relaxed text-gray-300">{t('about.chords1')}</p>
                <p className="mt-3 leading-relaxed text-gray-300">{t('about.chords2')}</p>
                <Link
                  href="/transcricao-musical"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-primary-600 px-5 py-3 font-bold text-white hover:from-cyan-500 hover:to-primary-500"
                >{t('about.chordsCta')}<FiFileText />
                </Link>
              </div>
              <div className="grid gap-3">
                {[
                  [t('about.chordsItem1Title'), t('about.chordsItem1Text')],
                  [t('about.chordsItem2Title'), t('about.chordsItem2Text')],
                  [t('about.chordsItem3Title'), t('about.chordsItem3Text')],
                  [t('about.chordsItem4Title'), t('about.chordsItem4Text')],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-gray-800 bg-black/45 p-4">
                    <h3 className="font-bold text-white">{title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="gradient-text">{t('about.featuresTitle')}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-primary-500 transition-colors"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-600 to-purple-600 rounded-lg mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Valores Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gradient-to-r from-primary-600/20 to-purple-600/20 border border-primary-500/30 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-center">
              <span className="gradient-text">{t('about.valuesTitle')}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <FiHeart className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{t('about.value1Title')}</h3>
                <p className="text-gray-400 text-sm">{t('about.value1Text')}</p>
              </div>
              <div>
                <FiUsers className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{t('about.value2Title')}</h3>
                <p className="text-gray-400 text-sm">{t('about.value2Text')}</p>
              </div>
              <div>
                <FiAward className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{t('about.value3Title')}</h3>
                <p className="text-gray-400 text-sm">{t('about.value3Text')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <FiShield className="mb-4 h-8 w-8 text-primary-400" />
              <h2 className="text-2xl font-bold">{t('about.historyTitle')}</h2>
              <p className="mt-3 leading-relaxed text-gray-400">{t('about.historyText')}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <FiGlobe className="mb-4 h-8 w-8 text-primary-400" />
              <h2 className="text-2xl font-bold">{t('about.promotionTitle')}</h2>
              <p className="mt-3 leading-relaxed text-gray-400">{t('about.promotionText')}</p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">{t('about.helpTitle')}</h2>
            <p className="text-gray-400 mb-6">{t('about.helpText')}</p>
            {!showEmail ? (
              <button
                onClick={handleEmailClick}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
              >{t('about.showEmail')}</button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl font-semibold text-white">{email}</span>
                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title={t('about.copyEmail')} aria-label={t('about.copyEmail')}
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
    </div>
    </>
  )
}
