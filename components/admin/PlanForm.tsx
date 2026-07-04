'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { FiLoader } from 'react-icons/fi'

interface PlanFormProps {
  plan?: {
    id: string
    name: string
    slug: string
    price: number
    durationMonths: number
    description?: string | null
    features?: string[] | null
    featuredMusicsPerMonth?: number | null
    hasPriorityFeatured?: boolean
    hasGoldBadge?: boolean
    hasPremiumLayout?: boolean
    isActive: boolean
  }
}

export default function PlanForm({ plan }: PlanFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    slug: plan?.slug || '',
    price: plan?.price || 0,
    durationMonths: plan?.durationMonths || 12,
    description: plan?.description || '',
    features: plan?.features?.join('\n') || '',
    featuredMusicsPerMonth: plan?.featuredMusicsPerMonth !== undefined && plan?.featuredMusicsPerMonth !== null ? plan.featuredMusicsPerMonth : '',
    hasPriorityFeatured: plan?.hasPriorityFeatured || false,
    hasGoldBadge: plan?.hasGoldBadge || false,
    hasPremiumLayout: plan?.hasPremiumLayout || false,
    isActive: plan?.isActive !== undefined ? plan.isActive : true,
  })

  useEffect(() => {
    if (!plan && formData.name) {
      setFormData(prev => ({
        ...prev,
        slug: slugify(prev.name),
      }))
    }
  }, [formData.name, plan])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const featuresArray = formData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0)

      const url = plan ? `/api/admin/plans/${plan.id}` : '/api/admin/plans'
      const method = plan ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          features: featuresArray,
          featuredMusicsPerMonth: formData.featuredMusicsPerMonth || null,
          hasPriorityFeatured: formData.hasPriorityFeatured,
          hasGoldBadge: formData.hasGoldBadge,
          hasPremiumLayout: formData.hasPremiumLayout,
        }),
      })

      if (res.ok) {
        router.push('/admin/planos')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        alert(data.error || 'Erro ao salvar plano')
      }
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error)
      if (error.message?.includes('CERT') || error.message?.includes('certificate')) {
        alert('Erro de certificado SSL. Por favor, verifique sua conexão ou tente novamente.')
      } else if (error.message?.includes('Failed to fetch')) {
        alert('Erro de conexão. Verifique sua internet e tente novamente.')
      } else {
        alert(`Erro ao salvar plano: ${error.message || 'Erro desconhecido'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Nome do Plano *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Ex: Plano Premium"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="slug" className="block text-sm font-medium mb-2">
              Slug *
            </label>
            <input
              id="slug"
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="plano-premium"
            />
            <p className="text-xs text-gray-400 mt-1">
              URL amigável (será gerado automaticamente se deixar em branco)
            </p>
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium mb-2">
              Preço (R$) *
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label htmlFor="durationMonths" className="block text-sm font-medium mb-2">
              Duração (meses) *
            </label>
            <input
              id="durationMonths"
              type="number"
              min="1"
              value={formData.durationMonths}
              onChange={(e) => setFormData({ ...formData, durationMonths: parseInt(e.target.value) || 12 })}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Ex: 12 para plano anual
            </p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="featuredMusicsPerMonth" className="block text-sm font-medium mb-2">
              Músicas em Destaque por Mês
            </label>
            <input
              id="featuredMusicsPerMonth"
              type="number"
              min="0"
              value={formData.featuredMusicsPerMonth}
              onChange={(e) => setFormData({ ...formData, featuredMusicsPerMonth: e.target.value ? parseInt(e.target.value) : '' })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Ex: 5"
            />
            <p className="text-xs text-gray-400 mt-1">
              Quantidade de músicas que o usuário pode colocar em destaque por mês (deixe vazio para ilimitado)
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-3">
              Vantagens Especiais do Plano
            </label>
            <div className="space-y-3 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.hasPriorityFeatured}
                  onChange={(e) => setFormData({ ...formData, hasPriorityFeatured: e.target.checked })}
                  className="mt-1 w-4 h-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                />
                <div className="flex-1">
                  <span className="font-medium text-yellow-400">⭐ Destaques com Prioridade Máxima</span>
                  <p className="text-xs text-gray-400 mt-1">
                    Os destaques deste plano aparecem antes dos planos básicos na vitrine
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.hasGoldBadge}
                  onChange={(e) => setFormData({ ...formData, hasGoldBadge: e.target.checked })}
                  className="mt-1 w-4 h-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                />
                <div className="flex-1">
                  <span className="font-medium text-yellow-400">🏆 Selo "Artista Ouro"</span>
                  <p className="text-xs text-gray-400 mt-1">
                    Badge dourado exibido no perfil do compositor para destacar status premium
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.hasPremiumLayout}
                  onChange={(e) => setFormData({ ...formData, hasPremiumLayout: e.target.checked })}
                  className="mt-1 w-4 h-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                />
                <div className="flex-1">
                  <span className="font-medium text-yellow-400">✨ Layout Premium</span>
                  <p className="text-xs text-gray-400 mt-1">
                    Página do artista com layout exclusivo: capa maior, destaque visual e botão "Ouça agora" mais chamativo
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Descreva os benefícios deste plano..."
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="features" className="block text-sm font-medium mb-2">
              Features (uma por linha)
            </label>
            <textarea
              id="features"
              value={formData.features}
              onChange={(e) => setFormData({ ...formData, features: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500 font-mono text-sm"
              placeholder="Cadastro ilimitado de músicas&#10;Cadastro ilimitado de vídeos&#10;Página exclusiva personalizada"
            />
            <p className="text-xs text-gray-400 mt-1">
              Liste os benefícios do plano, um por linha
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary-600 bg-gray-800 border-gray-700 rounded focus:ring-primary-500"
              />
              <span>Plano Ativo</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              Planos inativos não aparecerão na página de planos para novos usuários
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <FiLoader className="w-5 h-5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
