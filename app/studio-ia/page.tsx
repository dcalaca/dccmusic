import * as db from '@/lib/db'
import { TikTokViewContent } from '@/components/TikTokEvents'
import { FreeMusicPlanNotice, StudioCouponButton, StudioHeroActions, StudioPlanButton, StudioTopupButton } from './StudioActions'
import {
  FiCheck,
  FiCpu,
  FiFileText,
  FiFolder,
  FiHeadphones,
  FiImage,
  FiMusic,
  FiPenTool,
  FiShield,
  FiShare2,
  FiStar,
  FiZap,
} from 'react-icons/fi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const features = [
  { icon: FiMusic, title: 'Criação de músicas completas', text: 'Transforme letra e ideia em uma música pronta para ouvir.' },
  { icon: FiPenTool, title: 'Letras inteligentes', text: 'Letras brasileiras, cantáveis e sem rimas forçadas.' },
  { icon: FiImage, title: 'Capas automáticas com IA', text: 'Capas rápidas e opção premium com visual profissional.' },
  { icon: FiFolder, title: 'Projetos organizados', text: 'Rascunhos, versões, capas, letras e áudio no mesmo lugar.' },
  { icon: FiZap, title: 'Publicação no DCC Music', text: 'Publique a música no perfil e compartilhe publicamente.' },
  { icon: FiHeadphones, title: 'Player profissional', text: 'Player bonito, preview e experiência premium.' },
  { icon: FiShare2, title: 'Compartilhamento fácil', text: 'Link público e player embedável para divulgar fora da plataforma.' },
  { icon: FiFileText, title: 'Partitura e Cifra', text: 'Gere PDF, MusicXML e letra cifrada das músicas criadas no Studio IA.' },
  { icon: FiStar, title: 'Estética premium', text: 'Visual moderno, artístico e feito para compositores.' },
]

const steps = [
  ['1', 'Escreva sua ideia', 'Conte o tema, estilo e clima da música.'],
  ['2', 'A IA cria a letra', 'Receba uma letra completa, organizada por partes.'],
  ['3', 'Transforme em música', 'Gere áudio com voz, melodia e instrumental.'],
  ['4', 'Publique no DCC Music', 'Compartilhe sua música e coloque no seu perfil.'],
]

const studioPlanSlugs = ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia']

const planPresentation: Record<string, { ideal: string; highlight: string; tone: string }> = {
  'studio-start': {
    ideal: 'usuários iniciantes',
    highlight: '',
    tone: 'border-gray-800 bg-gray-950/70',
  },
  'studio-pro': {
    ideal: 'compositores ativos',
    highlight: 'MAIS POPULAR',
    tone: 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black shadow-2xl shadow-purple-950/30 scale-[1.02]',
  },
  'studio-elite': {
    ideal: 'usuários avançados e criadores intensivos',
    highlight: 'ELITE',
    tone: 'border-yellow-400/70 bg-gradient-to-br from-yellow-950/40 via-purple-950/50 to-black shadow-2xl shadow-yellow-950/20',
  },
  'dcc-studio-ia': {
    ideal: 'compositores ativos',
    highlight: '',
    tone: 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black',
  },
}

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return studioPlanSlugs.includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

async function getStudioPlans() {
  const plans = await db.getPlans()
  return plans.filter(isStudioPlan)
}

export const metadata = {
  title: 'DCC Studio IA - Crie Músicas com Inteligência Artificial',
  description:
    'Crie letras, músicas completas, capas e versões com IA. Organize projetos, publique no DCC Music e gere partitura e cifra das suas criações.',
  keywords: [
    'Studio IA',
    'música com inteligência artificial',
    'criar música com IA',
    'letra com IA',
    'DCC Music',
    'compositor',
  ],
  alternates: {
    canonical: '/studio-ia',
  },
  openGraph: {
    title: 'DCC Studio IA | DCC Music',
    description: 'Crie letras, músicas completas e capas profissionais com Inteligência Artificial.',
    url: 'https://www.dccmusic.online/studio-ia',
    type: 'website',
  },
}

export default async function StudioIALandingPage() {
  const plans = await getStudioPlans()

  return (
    <div className="min-h-screen overflow-hidden bg-black">
      <TikTokViewContent
        contentId="studio_ia"
        contentName="DCC Studio IA"
      />
      <section className="relative py-7 sm:py-14">
        <div className="absolute left-1/2 top-0 hidden h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-3xl sm:block" />
        <div className="absolute right-0 top-40 hidden h-72 w-72 rounded-full bg-primary-500/20 blur-3xl sm:block" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-xs font-bold text-purple-100">
              <FiCpu /> Estúdio criativo premium com IA
            </div>
            <h1 className="mb-3 text-3xl font-black leading-tight sm:text-5xl">
              <span className="gradient-text">DCC Studio IA</span>
            </h1>
            <p className="mx-auto mb-2 max-w-3xl text-base font-semibold leading-snug text-gray-100 sm:text-xl">
              Crie sua música com IA, direto pelo celular.
            </p>
            <p className="mx-auto mb-5 max-w-3xl text-sm leading-relaxed text-gray-400">
              Escreva a ideia, escolha o estilo e gere letra, áudio, capa e página pública em poucos passos.
            </p>
            <StudioHeroActions />
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-[1.5rem] border border-purple-500/30 bg-gradient-to-br from-gray-950 via-black to-purple-950/40 p-3 shadow-2xl shadow-purple-950/30 sm:mt-8">
            <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-black/80 p-5 text-left">
                <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-purple-300">Seu estúdio em minutos</p>
                      <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">Da ideia ao áudio pronto</h3>
                    </div>
                    <span className="rounded-full border border-purple-500/40 bg-purple-600/20 px-3 py-1 text-xs font-bold text-purple-100">
                      IA + Studio
                    </span>
                  </div>

                  <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Preview da música</p>
                    <div className="flex h-24 items-end gap-1.5">
                      {[38, 64, 45, 82, 58, 94, 52, 76, 43, 88, 61, 72, 49, 90, 55, 68, 42, 80].map((height, index) => (
                        <span
                          key={`${height}-${index}`}
                          className="flex-1 rounded-t-md bg-gradient-to-t from-primary-600 to-purple-300"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>Letra, voz e instrumental</span>
                      <span>2 versões</span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['1', 'Ideia', 'Tema, estilo e clima'],
                      ['2', 'Letra', 'Partes organizadas'],
                      ['3', 'Música', 'Áudio completo'],
                      ['4', 'Publicação', 'Página para compartilhar'],
                    ].map(([number, title, text]) => (
                      <div key={number} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-black text-white">
                          {number}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">{title}</p>
                          <p className="text-xs text-gray-500">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-5 text-left">
                <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">O que você recebe</p>
                <div className="space-y-3">
                  {[
                    { label: 'Letra completa', icon: FiPenTool },
                    { label: 'Música com voz', icon: FiHeadphones },
                    { label: 'Capa para divulgar', icon: FiImage },
                    { label: 'Projeto salvo na sua conta', icon: FiFolder },
                    { label: 'Link público compartilhável', icon: FiShare2 },
                  ].map(({ label, icon: ItemIcon }) => {
                    return (
                      <div key={label} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-black/40 p-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/20 text-purple-200">
                          <ItemIcon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-semibold text-gray-200">{label}</span>
                        <FiCheck className="ml-auto h-4 w-4 text-green-300" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5 text-center sm:mb-7">
            <h2 className="text-2xl font-black sm:text-3xl">Tudo em um só lugar</h2>
            <p className="mt-2 text-sm text-gray-400">Letra, música, capa, projetos e publicação sem complicar.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 transition hover:border-purple-500">
                  <Icon className="mb-2 h-5 w-5 text-purple-300" />
                  <h3 className="mb-1 text-sm font-bold">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{feature.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5 text-center sm:mb-7">
            <h2 className="text-2xl font-black sm:text-3xl">Como funciona</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {steps.map(([number, title, text]) => (
              <div key={number} className="flex gap-3 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-950 to-black p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-black">{number}</div>
                <div>
                  <h3 className="mb-1 text-sm font-bold">{title}</h3>
                  <p className="text-xs leading-relaxed text-gray-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-purple-700/50 bg-gradient-to-br from-purple-950/50 via-gray-950 to-black p-5 sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-200">
                <FiShield className="h-6 w-6" />
              </div>
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
                  Primeiro registro da sua criação
                </p>
                <h2 className="text-xl font-black sm:text-2xl">
                  Sua música nasce com histórico dentro da DCC Music
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                  Ao criar sua letra e sua música no DCC Studio IA, o projeto fica registrado com data,
                  autoria da conta e histórico de criação dentro da plataforma.
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Esse histórico serve como apoio de anterioridade e organização da criação. Ele não substitui
                  registros oficiais de direitos autorais quando forem necessários.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-24 py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-8">
            <h2 className="text-2xl font-black sm:text-3xl">
              <span className="gradient-text">Planos DCC Studio IA</span>
            </h2>
            <p className="mt-2 text-sm text-gray-400">Escolha plano ou recarga avulsa para continuar criando.</p>
            <FreeMusicPlanNotice />
          </div>

          <div className="mb-6 rounded-[1.5rem] border border-purple-700/50 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black p-4 sm:mb-7 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">Sem mensalidade</p>
                <h3 className="text-xl font-black sm:text-2xl">Recarga avulsa de músicas</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                  Para quem não quer assinar agora: escolha quantas músicas quer comprar e o sistema calcula o valor automaticamente.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[260px]">
                <StudioTopupButton />
                <StudioCouponButton />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
              {[
                ['1 música', 'R$ 2,99 por música'],
                ['2 a 8 músicas', 'R$ 2,49 por música'],
                ['9 a 29 músicas', 'R$ 2,34 por música'],
                ['A partir de 30', 'R$ 1,99 por música'],
              ].map(([label, price]) => (
                <div key={label} className="rounded-2xl border border-gray-800 bg-black/50 p-3 sm:p-5">
                  <p className="text-xs text-gray-400 sm:text-sm">{label}</p>
                  <p className="mt-1 text-sm font-black text-white sm:mt-2 sm:text-xl">{price}</p>
                </div>
              ))}
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-[2rem] border border-gray-800 bg-gray-950/70 p-10 text-center">
              <p className="text-lg font-bold text-white">Nenhum plano Studio IA ativo no momento.</p>
              <p className="mt-2 text-sm text-gray-400">Ative ou cadastre os planos no painel administrativo.</p>
            </div>
          ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const presentation = planPresentation[plan.slug] || planPresentation['dcc-studio-ia']
              const features = Array.isArray(plan.features) ? plan.features : []

              return (
                <div key={plan.id} className={`relative rounded-[1.5rem] border p-5 sm:p-6 ${presentation.tone}`}>
                {presentation.highlight && (
                  <div className="mb-3 inline-flex rounded-full border border-purple-300/60 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-100 sm:absolute sm:right-6 sm:top-6 sm:mb-0">
                    {presentation.highlight}
                  </div>
                )}
                <h3 className="mb-1 text-xl font-black sm:text-2xl">{plan.name}</h3>
                <p className="mb-3 text-sm text-gray-400">Ideal para {presentation.ideal}</p>
                <div className="mb-4">
                  <span className="text-3xl font-black text-white">{formatCurrency(plan.price)}</span>
                  <span className="text-gray-400">/{plan.durationMonths === 1 ? 'mês' : `${plan.durationMonths} meses`}</span>
                </div>
                {features.length > 0 && (
                  <ul className="mb-5 space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-gray-300">
                      <FiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-300" />
                      {feature}
                    </li>
                  ))}
                  </ul>
                )}
                <StudioPlanButton planSlug={plan.slug} />
              </div>
              )
            })}
          </div>
          )}
        </div>
      </section>
    </div>
  )
}
