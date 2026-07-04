import * as db from '@/lib/db'
import Link from 'next/link'
import { FiCheck, FiCreditCard, FiZap } from 'react-icons/fi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isGoldPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return Boolean(
    plan.hasGoldBadge ||
    plan.hasPriorityFeatured ||
    identity.includes('ouro') ||
    identity.includes('gold')
  )
}

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

function getPlanFeatures(plan: db.Plan) {
  const features = Array.isArray(plan.features) ? [...plan.features] : []

  if (isGoldPlan(plan) && !features.some((feature) => /gerador de capas ia/i.test(feature))) {
    features.push('Gerador de Capas IA com 100 capas por mês')
  }

  return features
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getStudioPlanTone(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  if (identity.includes('elite')) return 'border-yellow-400/70 bg-gradient-to-br from-yellow-950/40 via-purple-950/50 to-black shadow-yellow-950/20'
  if (identity.includes('pro')) return 'border-purple-400/70 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black shadow-purple-950/30'
  return 'border-purple-700/60 bg-gray-950/70'
}

export default async function PlansPage() {
  const allPlans = await db.getPlans()
  const studioPlans = allPlans.filter(isStudioPlan)
  const composerPlans = allPlans.filter((plan) => !isStudioPlan(plan))

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center sm:mb-12">
            <h1 className="mb-4 text-3xl font-bold sm:text-5xl">
              <span className="gradient-text">Planos de Assinatura</span>
            </h1>
            <p className="mb-4 text-base text-gray-400 sm:text-lg">
              Escolha como quer criar, publicar e divulgar suas músicas.
            </p>
            <div className="bg-primary-900/30 border border-primary-800 rounded-lg p-4 max-w-3xl mx-auto">
              <p className="text-primary-300 text-sm">
                <strong>Dica:</strong> O DCC Studio IA é para criar músicas com inteligência artificial. Os planos de compositor são para publicar e divulgar músicas e vídeos no DCC Music.
              </p>
            </div>
          </div>

          <section className="mb-10 sm:mb-12">
            <div className="mb-5 flex items-start gap-3">
              <FiCreditCard className="h-6 w-6 text-purple-300" />
              <div>
                <p className="mb-1 text-sm font-bold uppercase tracking-wide text-purple-300">Sem mensalidade</p>
                <h2 className="text-xl font-black sm:text-2xl">Recarga avulsa de músicas</h2>
                <p className="text-sm text-gray-400">Para quem não quer assinar agora: escolha quantas músicas quer comprar e o sistema calcula o valor automaticamente.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black p-5 sm:rounded-3xl sm:p-6">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['1 música', 'R$ 2,99 por música'],
                    ['2 a 8 músicas', 'R$ 2,49 por música'],
                    ['9 a 29 músicas', 'R$ 2,34 por música'],
                    ['A partir de 30', 'R$ 1,99 por música'],
                  ].map(([label, price]) => (
                    <div key={label} className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="mt-1 text-lg font-black text-white">{price}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/compositores/admin/studio-ia/recarga"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/70 bg-purple-950/50 px-6 py-4 font-bold text-purple-100 hover:border-purple-300 md:w-auto"
                >
                  <FiCreditCard />
                  Comprar Recarga Avulsa
                </Link>
              </div>
            </div>
          </section>

          <section className="mb-12 sm:mb-14">
            <div className="mb-5 flex items-start gap-3">
              <FiZap className="h-6 w-6 text-purple-300" />
              <div>
                <h2 className="text-xl font-black sm:text-2xl">Planos DCC Studio IA</h2>
                <p className="text-sm text-gray-400">Nosso produto principal: crie letras, músicas, capas e projetos com IA.</p>
              </div>
            </div>

            {studioPlans.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-6 text-center text-gray-400">
                Nenhum plano Studio IA ativo no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {studioPlans.map((plan) => {
                  const features = Array.isArray(plan.features) ? plan.features : []
                  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()

                  return (
                    <div key={plan.id} className={`relative flex h-full flex-col rounded-2xl border p-5 shadow-lg sm:rounded-3xl sm:p-8 ${getStudioPlanTone(plan)}`}>
                      {identity.includes('pro') && (
                        <div className="absolute right-5 top-5 rounded-full border border-purple-300/60 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-100">
                          MAIS POPULAR
                        </div>
                      )}
                      <h3 className="mb-2 text-2xl font-black">{plan.name}</h3>
                      <div className="mb-6">
                        <span className="text-3xl font-black text-white sm:text-4xl">{formatCurrency(plan.price)}</span>
                        <span className="text-gray-400">/{plan.durationMonths === 1 ? 'mês' : `${plan.durationMonths} meses`}</span>
                      </div>
                      {plan.description && <p className="mb-5 text-sm text-gray-400">{plan.description}</p>}
                      {features.length > 0 && (
                        <ul className="mb-8 flex-grow space-y-3">
                          {features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                              <FiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-300" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href={`/compositores/checkout?plan=${plan.slug}`}
                        className="mt-auto block w-full rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-4 text-center font-bold text-white hover:from-primary-700 hover:to-purple-700"
                      >
                        ✨ Assinar Studio IA
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section id="compositor-premium" className="scroll-mt-24">
            <div className="mb-5">
              <h2 className="text-xl font-black sm:text-2xl">Planos para Compositor Premium</h2>
              <p className="text-sm text-gray-400">Para publicar suas músicas e vídeos no DCC Music com página exclusiva.</p>
            </div>

          {composerPlans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">
                Nenhum plano de compositor disponível no momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {composerPlans.map((plan) => {
                const goldPlan = isGoldPlan(plan)
                const features = getPlanFeatures(plan)

                return (
                  <div
                    key={plan.id}
                    className={`relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-all sm:p-8 ${
                      goldPlan
                        ? 'bg-gradient-to-br from-yellow-950/30 via-gray-900/70 to-purple-950/40 border border-yellow-500/60 hover:border-yellow-400 shadow-lg shadow-yellow-950/20'
                        : 'bg-gray-900/50 border border-gray-800 hover:border-primary-500'
                    }`}
                  >
                    {goldPlan && (
                      <div className="absolute right-4 top-4 rounded-full border border-yellow-400/50 bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-200">
                        Plano Ouro
                      </div>
                    )}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline flex-wrap">
                      <span className="text-3xl font-bold text-primary-400">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-gray-400 ml-2 text-sm">
                        /{plan.durationMonths === 12 ? 'ano' : `${plan.durationMonths} meses`}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-gray-400 mt-2 text-sm">{plan.description}</p>
                    )}
                  </div>

                  {features.length > 0 && (
                    <ul className="space-y-3 mb-8 flex-grow">
                      {features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <FiCheck className={`w-5 h-5 mt-0.5 flex-shrink-0 ${goldPlan ? 'text-yellow-300' : 'text-primary-400'}`} />
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href={`/compositores/checkout?plan=${plan.slug}`}
                    className="block w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium text-center mt-auto"
                  >
                    Assinar Agora
                  </Link>
                  </div>
                )
              })}
            </div>
          )}
          </section>
        </div>
      </div>
    </div>
  )
}
