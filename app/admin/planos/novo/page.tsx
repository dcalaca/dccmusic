import { requireAuth } from '@/lib/auth-helpers'
import PlanForm from '@/components/admin/PlanForm'

export default function NovoPlanoPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Novo Plano</span>
          </h1>
          <p className="text-gray-400">Crie um novo plano de assinatura</p>
        </div>
        <PlanForm />
      </div>
    </div>
  )
}
