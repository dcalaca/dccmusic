import { requireAuth } from '@/lib/auth-helpers'
import Link from 'next/link'
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX } from 'react-icons/fi'
import DeletePlanButton from '@/components/admin/DeletePlanButton'
import * as db from '@/lib/db'

export default async function PlanosPage() {
  await requireAuth()
  const plans = (await db.getAllPlans()).filter((plan) => plan.slug !== 'dcc-studio-ia')

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Gerenciar Planos</span>
            </h1>
            <p className="text-gray-400">Crie e gerencie planos de assinatura para compositores</p>
          </div>
          <Link
            href="/admin/planos/novo"
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium flex items-center space-x-2"
          >
            <FiPlus className="w-5 h-5" />
            <span>Novo Plano</span>
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400 text-lg mb-4">Nenhum plano cadastrado</p>
            <Link
              href="/admin/planos/novo"
              className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
            >
              Criar Primeiro Plano
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <div
                key={plan.id}
                className={`bg-gray-900/50 border rounded-lg p-6 ${
                  plan.isActive ? 'border-gray-800' : 'border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
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
                      <span className="text-3xl font-bold text-primary-400">
                        R$ {plan.price.toFixed(2)}
                      </span>
                      <span className="text-gray-400 ml-2">
                        /{plan.durationMonths === 12 ? 'ano' : `${plan.durationMonths} meses`}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                    )}
                    {plan.featuredMusicsPerMonth && (
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-primary-900/50 text-primary-300 text-xs rounded">
                          {plan.featuredMusicsPerMonth} música{plan.featuredMusicsPerMonth !== 1 ? 's' : ''} em destaque/mês
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                        <FiCheck className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center space-x-2">
                  <Link
                    href={`/admin/planos/${plan.id}/editar`}
                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-medium text-center flex items-center justify-center space-x-2"
                  >
                    <FiEdit className="w-4 h-4" />
                    <span>Editar</span>
                  </Link>
                  <DeletePlanButton planId={plan.id} planName={plan.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
