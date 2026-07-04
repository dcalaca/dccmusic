'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiMusic, FiVideo, FiUsers, FiAward, FiHeart, FiCopy, FiCheck, FiZap, FiEdit3, FiShield, FiGlobe } from 'react-icons/fi'
import Image from 'next/image'

// Metadata removida porque agora é client component

const features = [
  {
    icon: FiZap,
    title: 'DCC Studio IA',
    description: 'Crie letras, músicas completas, versões, capas e projetos organizados com apoio de inteligência artificial.',
  },
  {
    icon: FiEdit3,
    title: 'Criação simples',
    description: 'Uma experiência pensada para quem tem uma ideia, um trecho cantado ou uma letra e quer transformar isso em música pronta.',
  },
  {
    icon: FiMusic,
    title: 'Músicas e versões',
    description: 'Cada projeto pode guardar letra, áudio, capa, histórico e diferentes versões para o compositor escolher a melhor.',
  },
  {
    icon: FiVideo,
    title: 'Divulgação',
    description: 'Músicas, vídeos, perfis e links públicos ajudam o compositor a apresentar seu trabalho com mais profissionalismo.',
  },
  {
    icon: FiUsers,
    title: 'Área do compositor',
    description: 'O compositor tem um painel próprio para gerenciar dados, músicas, vídeos, créditos e criações no Studio IA.',
  },
  {
    icon: FiAward,
    title: 'Planos e Créditos',
    description: 'Use planos mensais ou recargas avulsas para criar novas músicas conforme sua necessidade.',
  },
]

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Sobre o DCC Music',
  description: 'Conheça o DCC Music, uma plataforma para compositores criarem músicas com IA, organizarem projetos e divulgarem suas obras.',
  publisher: {
    '@type': 'Organization',
    name: 'DCC Music',
    url: 'https://www.dccmusic.online',
  },
}

export default function SobrePage() {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
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
            <span className="gradient-text">Sobre o DCC Music</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            A DCC Music ajuda compositores a transformar ideias em músicas completas,
            organizar seus projetos e divulgar suas criações com mais profissionalismo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/studio-ia"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
            >
              <FiZap />
              Conhecer o Studio IA
            </Link>
            <Link
              href="/compositores"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-6 py-3 font-bold text-gray-100 hover:border-purple-500"
            >
              <FiUsers />
              Ver compositores
            </Link>
          </div>
        </div>

        {/* História Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-primary-400">Por que a DCC Music existe</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                Muita gente tem uma boa ideia de música, mas não sabe como transformar
                essa ideia em uma canção pronta para ouvir. Às vezes falta letra organizada,
                produção, capa, divulgação ou simplesmente uma ferramenta fácil de usar.
              </p>
              <p>
                A DCC Music nasceu para diminuir essa distância. A plataforma reúne
                criação com IA, organização de projetos, área do compositor, músicas,
                vídeos e recursos de divulgação em um só lugar.
              </p>
              <p>
                O foco é ser simples. O compositor pode escrever uma ideia, enviar uma
                letra, gravar um trecho cantando ou mandar uma música pronta para melhorar.
                O Studio IA ajuda a continuar o processo até virar uma música mais completa.
              </p>
              <p>
                Cada criação fica salva em projetos com histórico, versões, data, letra,
                áudio e capa. Assim o compositor consegue voltar depois, comparar versões
                e escolher a melhor música para seguir trabalhando.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <div className="overflow-hidden rounded-3xl border border-purple-700/50 bg-gradient-to-br from-purple-950/60 via-black to-gray-950 p-8 shadow-2xl shadow-purple-950/20">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-sm text-purple-100">
                  <FiZap />
                  Criação musical com IA
                </span>
                <h2 className="text-3xl font-black sm:text-4xl">
                  Studio IA: da ideia à música pronta
                </h2>
                <p className="mt-4 leading-relaxed text-gray-300">
                  O Studio IA foi criado para ajudar o compositor em todas as etapas:
                  escrever ou melhorar letras, gerar músicas, gravar voz no navegador,
                  usar uma versão como inspiração, criar capas e manter tudo organizado.
                </p>
                <p className="mt-3 leading-relaxed text-gray-300">
                  A ideia é dar autonomia para quem compõe. Você não precisa entender de
                  tecnologia: basta informar o que quer criar e acompanhar o projeto dentro
                  da sua conta.
                </p>
                <Link
                  href="/studio-ia"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
                >
                  Explorar o Studio IA
                  <FiZap />
                </Link>
              </div>
              <div className="grid gap-3">
                {[
                  ['Letras com IA', 'Crie, melhore ou complete letras de forma simples.'],
                  ['Gravar no site', 'Cante um trecho e use a gravação como referência.'],
                  ['Versões da música', 'Ouça as versões geradas e escolha a melhor.'],
                  ['Projetos salvos', 'Letra, áudio, capa e histórico ficam organizados.'],
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
            <span className="gradient-text">O que a plataforma oferece</span>
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
              <span className="gradient-text">Nosso jeito de trabalhar</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <FiHeart className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Música em primeiro lugar</h3>
                <p className="text-gray-400 text-sm">
                  A tecnologia precisa servir à música, não complicar a vida do compositor.
                </p>
              </div>
              <div>
                <FiUsers className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Simplicidade</h3>
                <p className="text-gray-400 text-sm">
                  A plataforma é feita para pessoas simples conseguirem criar sem dificuldade.
                </p>
              </div>
              <div>
                <FiAward className="w-8 h-8 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Organização</h3>
                <p className="text-gray-400 text-sm">
                  Cada música precisa ficar registrada, fácil de encontrar e pronta para continuar.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <FiShield className="mb-4 h-8 w-8 text-primary-400" />
              <h2 className="text-2xl font-bold">Histórico organizado</h2>
              <p className="mt-3 leading-relaxed text-gray-400">
                Projetos criados no Studio IA ficam registrados com letra, áudio, versões,
                capa e data. Isso ajuda o compositor a acompanhar o caminho de cada música.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <FiGlobe className="mb-4 h-8 w-8 text-primary-400" />
              <h2 className="text-2xl font-bold">Da criação à divulgação</h2>
              <p className="mt-3 leading-relaxed text-gray-400">
                O compositor pode criar em um ambiente privado, escolher a melhor versão
                e depois compartilhar ou publicar sua música com mais presença profissional.
              </p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Precisa de ajuda?</h2>
            <p className="text-gray-400 mb-6">
              Fale com o suporte. Se a dúvida for sobre uma música do Studio IA,
              envie também o código do projeto para facilitar o atendimento.
            </p>
            {!showEmail ? (
              <button
                onClick={handleEmailClick}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
              >
                Ver Email
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl font-semibold text-white">{email}</span>
                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
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
    </div>
    </>
  )
}
