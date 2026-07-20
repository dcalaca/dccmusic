import Image from 'next/image'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  FiArrowRight,
  FiBarChart2,
  FiCheck,
  FiExternalLink,
  FiHeadphones,
  FiHeart,
  FiMegaphone,
  FiMusic,
  FiShield,
  FiZap,
} from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'Distribuição Digital | DCC Music + SomVibe',
  description:
    'Distribua sua música no Spotify, Apple Music, TikTok, YouTube e mais de 45 plataformas com a SomVibe, parceira da DCC Music.',
  keywords: [
    'distribuição digital',
    'SomVibe',
    'Spotify',
    'Apple Music',
    'distribuir música',
    'artista independente',
    'DCC Music',
  ],
  alternates: {
    canonical: '/distribuicao-digital',
  },
  openGraph: {
    title: 'Distribuição Digital | DCC Music + SomVibe',
    description:
      'Envie sua música para mais de 45 plataformas de streaming com a SomVibe, parceira da DCC Music.',
    url: 'https://www.dccmusic.online/distribuicao-digital',
    type: 'website',
  },
}

const SOMVIBE_AFFILIATE_URL = 'https://app.somvibe.com/invite/a/11197'

const platforms = ['Spotify', 'Apple Music', 'TikTok', 'YouTube', 'Amazon Music', 'Deezer']

const benefits = [
  {
    icon: FiMusic,
    title: 'Distribuição ilimitada',
    text: 'Envie músicas sem taxa abusiva e alcance as principais lojas digitais.',
  },
  {
    icon: FiHeadphones,
    title: 'Mais de 45 plataformas',
    text: 'Spotify, Apple Music, TikTok, YouTube e muitas outras DSPs.',
  },
  {
    icon: FiBarChart2,
    title: 'Dashboard claro',
    text: 'Acompanhe o desempenho das faixas e tome melhores decisões.',
  },
  {
    icon: FiHeart,
    title: 'Suporte humanizado',
    text: 'Equipe rápida para tirar dúvidas durante toda a jornada.',
  },
]

const services = [
  {
    icon: FiZap,
    title: 'Distribuição digital',
    text: 'Lance suas músicas de forma simples, prática e sem burocracia.',
  },
  {
    icon: FiMegaphone,
    title: 'Marketing',
    text: 'Pré-save, smartlink e ferramentas para impulsionar lançamentos.',
  },
  {
    icon: FiShield,
    title: 'Suporte',
    text: 'Ajuda humana e rápida para artistas independentes.',
  },
  {
    icon: FiCheck,
    title: 'Treinamentos',
    text: 'Estratégias práticas para streams, TikTok, Spotify e novos fãs.',
  },
]

const plans = [
  {
    name: 'Anual',
    price: 'R$ 22,90',
    period: '/mês',
    highlight: 'Melhor custo',
    tone: 'border-primary-400/70 bg-gradient-to-br from-primary-950/60 via-gray-950 to-black',
  },
  {
    name: 'Semestral',
    price: 'R$ 34,90',
    period: '/mês',
    highlight: '',
    tone: 'border-gray-800 bg-gray-950/70',
  },
  {
    name: 'Trimestral',
    price: 'R$ 45,90',
    period: '/mês',
    highlight: '',
    tone: 'border-gray-800 bg-gray-950/70',
  },
]

const planFeatures = [
  'Artistas e músicas ilimitados',
  'Receba 80% da receita',
  'Pré-saves e smartlinks',
  'Analytics avançados',
  'Entrega para 45+ plataformas',
  'Códigos UPC e ISRC gratuitos',
  'Suporte humanizado',
]

function AffiliateButton({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={SOMVIBE_AFFILIATE_URL}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  )
}

export default function DistribuicaoDigitalPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-black">
      <section className="relative py-10 sm:py-16">
        <div className="absolute left-1/2 top-0 hidden h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-cyan-600/15 blur-3xl sm:block" />
        <div className="absolute right-0 top-32 hidden h-72 w-72 rounded-full bg-primary-500/20 blur-3xl sm:block" />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-gray-700 bg-gray-950/80 px-4 py-2">
              <Image
                src="/Somvibe.png"
                alt="SomVibe"
                width={140}
                height={36}
                className="h-7 w-auto"
                priority
              />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Parceira DCC Music</span>
            </div>

            <h1 className="mb-4 text-3xl font-black leading-tight sm:text-5xl">
              <span className="gradient-text">Distribuição Digital</span>
            </h1>
            <p className="mx-auto mb-3 max-w-3xl text-base font-semibold leading-snug text-gray-100 sm:text-xl">
              Envie sua música para mais de 45 plataformas de streaming.
            </p>
            <p className="mx-auto mb-7 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">
              A DCC Music é parceira da SomVibe para ajudar artistas independentes a lançar no Spotify,
              Apple Music, TikTok, YouTube e muito mais — com distribuição ilimitada e ferramentas do dia a dia.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AffiliateButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-black text-white transition hover:bg-primary-700 sm:text-base">
                Distribuir com a SomVibe
                <FiExternalLink className="h-4 w-4" />
              </AffiliateButton>
              <a
                href="#planos"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-6 py-3.5 text-sm font-bold text-gray-200 transition hover:border-primary-400 hover:text-white"
              >
                Ver planos
                <FiArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1.5 text-xs font-semibold text-gray-300"
                >
                  {platform}
                </span>
              ))}
              <span className="rounded-full border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                +40 outras
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">Por que escolher a SomVibe?</h2>
            <p className="mt-2 text-sm text-gray-400">
              Feita para artistas independentes que querem alcançar mais fãs e aumentar a receita com streams.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 transition hover:border-cyan-500/50"
                >
                  <Icon className="mb-3 h-5 w-5 text-cyan-300" />
                  <h3 className="mb-2 text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">O que você encontra</h2>
            <p className="mt-2 text-sm text-gray-400">
              Além de distribuir, você tem ferramentas para lançar e acompanhar melhor.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-950 to-black p-5"
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-600/20 text-primary-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mb-2 text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-24 py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl">Planos SomVibe</h2>
            <p className="mt-2 text-sm text-gray-400">
              Distribua artistas e músicas ilimitados. Os valores são da SomVibe e podem mudar no site oficial.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-2xl border p-5 ${plan.tone}`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Plano {plan.name}</p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="text-3xl font-black text-white">{plan.price}</span>
                      <span className="pb-1 text-sm text-gray-400">{plan.period}</span>
                    </div>
                  </div>
                  {plan.highlight ? (
                    <span className="rounded-full border border-primary-400/50 bg-primary-600/20 px-3 py-1 text-[11px] font-bold text-primary-100">
                      {plan.highlight}
                    </span>
                  ) : null}
                </div>

                <ul className="mb-5 space-y-2">
                  {planFeatures.map((feature) => (
                    <li key={`${plan.name}-${feature}`} className="flex items-start gap-2 text-xs text-gray-300">
                      <FiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <AffiliateButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white transition hover:bg-primary-700">
                  Assinar agora
                  <FiExternalLink className="h-4 w-4" />
                </AffiliateButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-cyan-800/50 bg-gradient-to-br from-cyan-950/40 via-gray-950 to-black p-6 sm:p-10">
            <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left">
              <div className="flex-1">
                <Image
                  src="/Somvibe.png"
                  alt="SomVibe"
                  width={180}
                  height={46}
                  className="mx-auto mb-4 h-9 w-auto lg:mx-0"
                />
                <h2 className="text-2xl font-black text-white sm:text-3xl">
                  Pronto para colocar sua música nas plataformas?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                  Cadastre-se pela SomVibe com o link da DCC Music. O cadastro e o pagamento acontecem no site
                  oficial deles; nós somos parceiros para facilitar sua distribuição digital.
                </p>
              </div>
              <div className="w-full max-w-xs shrink-0">
                <AffiliateButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-4 text-sm font-black text-white transition hover:bg-primary-700">
                  Começar no SomVibe
                  <FiExternalLink className="h-4 w-4" />
                </AffiliateButton>
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                  Ao clicar, você será direcionado para o site da SomVibe. Contato deles: suporte@somvibe.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
