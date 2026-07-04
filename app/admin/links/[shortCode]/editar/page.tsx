'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'

export default function EditarLinkPage() {
  const params = useParams()
  const router = useRouter()
  const shortCode = params.shortCode as string
  const [formData, setFormData] = useState({
    title: '',
    destinationUrl: '',
    notes: '',
    expiresAt: '',
    isActive: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (shortCode) {
      loadLink()
    }
  }, [shortCode])

  const loadLink = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/links/${shortCode}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar link')
      }
      
      const data = await response.json()
      setFormData({
        title: data.title,
        destinationUrl: data.destinationUrl,
        notes: data.notes || '',
        expiresAt: data.expiresAt
          ? new Date(data.expiresAt).toISOString().slice(0, 16)
          : '',
        isActive: data.isActive,
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar link')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const body: any = {
        title: formData.title,
        destinationUrl: formData.destinationUrl,
        notes: formData.notes,
        isActive: formData.isActive,
        expiresAt: formData.expiresAt || null, // Sempre enviar, mesmo se vazio
      }

      const response = await fetch(`/api/links/${shortCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : (errorData.error || 'Erro ao atualizar link')
        throw new Error(errorMessage)
      }

      router.push('/admin/links')
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar link')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-gray-400">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
        <Link
          href="/admin/links"
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Voltar para Links</span>
        </Link>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            <span className="gradient-text">Editar Link Rastreável</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">Atualize as informações do link</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                Título *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label htmlFor="destinationUrl" className="block text-sm font-medium text-gray-300 mb-1">
                URL de Destino *
              </label>
              <input
                type="url"
                id="destinationUrl"
                required
                value={formData.destinationUrl}
                onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-300 mb-1">
                Data de Expiração (opcional)
              </label>
              <input
                type="datetime-local"
                id="expiresAt"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 bg-gray-800 border-gray-700 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-300">Link ativo</span>
              </label>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <Link
                href="/admin/links"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-center"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
