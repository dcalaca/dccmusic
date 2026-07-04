import { requireAuth } from '@/lib/auth-helpers'
import PlanForm from '@/components/admin/PlanForm'
import * as db from '@/lib/db'

export default async function EditarPlanoPage({ params }: { params: { id: string } }) {
  await requireAuth()
  const plan = await db.getPlanById(params.id)

  if (!plan) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Plano não encontrado</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Editar Plano</span>
          </h1>
          <p className="text-gray-400">Edite as informações do plano</p>
        </div>
        <PlanForm plan={plan} />
      </div>
    </div>
  )
}
