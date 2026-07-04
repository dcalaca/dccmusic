import { requireAuth } from '@/lib/auth-helpers'
import Link from 'next/link'
import { FiCheck, FiEdit, FiPlus, FiX, FiZap } from 'react-icons/fi'
import * as db from '@/lib/db'

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

export default async function StudioPlanosPage() {
  await requireAuth()
  const plans = (await db.getAllPlans()).filter(isStudioPlan)

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-4 py-2 text-sm text-purple-200">
              <FiZap className="h-4 w-4" />
              Produto separado
            </div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Planos DCC Studio IA</span>
            </h1>
            <p className="text-gray-400">Administre somente os planos do estúdio criativo com IA.</p>
          </div>
          <Link
            href="/admin/planos/novo"
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 rounded-lg transition-all font-medium flex items-center space-x-2"
          >
            <FiPlus className="w-5 h-5" />
            <span>Novo Plano Studio</span>
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg mb-4">Nenhum plano Studio cadastrado</p>
            <p className="text-gray-500 text-sm mb-6">
              O plano base é criado pelo SQL-DCC-STUDIO-IA.sql. Para novos planos, crie em “Novo Plano Studio” usando “Studio IA” no nome/slug.
            </p>
            <Link href="/admin/planos/novo" className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium">
              Criar Plano Studio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative overflow-hidden rounded-lg p-6 border ${
                  plan.isActive
                    ? 'border-purple-500/60 bg-gradient-to-br from-purple-950/40 via-gray-900/70 to-black'
                    : 'border-gray-700 bg-gray-900/50 opacity-60'
                }`}
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-purple-500/20 blur-2xl" />
                <div className="relative flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      {plan.isActive ? (
                        <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded flex items-center space-x-1">
                          <FiCheck className="w-3 h-3" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded flex items-center space-x-1">
                          <FiX className="w-3 h-3" />
                          <span>Inativo</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline mb-2">
                      <span className="text-3xl font-bold text-purple-300">
                        R$ {plan.price.toFixed(2)}
                      </span>
                      <span className="text-gray-400 ml-2">
                        /{plan.durationMonths === 1 ? 'mês' : `${plan.durationMonths} meses`}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                    )}
                  </div>
                </div>

                {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                        <FiCheck className="w-4 h-4 text-purple-300 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href={`/admin/planos/${plan.id}/editar`}
                  className="relative w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-medium text-center flex items-center justify-center space-x-2"
                >
                  <FiEdit className="w-4 h-4" />
                  <span>Editar Plano Studio</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
