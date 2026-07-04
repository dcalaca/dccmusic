'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiCopy, FiCheck } from 'react-icons/fi'

export default function NovoLinkPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    destinationUrl: '',
    createdBy: '',
    notes: '',
    expiresAt: '',
  })
  const [createdLink, setCreatedLink] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCreatedLink(null)

    try {
      const body: any = {
        title: formData.title,
        destinationUrl: formData.destinationUrl,
      }

      if (formData.createdBy) body.createdBy = formData.createdBy
      if (formData.notes) body.notes = formData.notes
      if (formData.expiresAt) body.expiresAt = formData.expiresAt

      const response = await fetch('/api/links/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar link')
      }

      const link = await response.json()
      setCreatedLink(link)
      setFormData({
        title: '',
        destinationUrl: '',
        createdBy: '',
        notes: '',
        expiresAt: '',
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao criar link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
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
            <span className="gradient-text">Criar Novo Link Rastreável</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">Crie um link que rastreia cliques automaticamente</p>

          {createdLink ? (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-400 mb-4">
                Link criado com sucesso!
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Link Rastreável:
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLink.trackedUrl}
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-xs sm:text-sm text-white break-all"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink.trackedUrl)}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-md transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                    >
                      {copied ? (
                        <>
                          <FiCheck className="w-4 h-4" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <FiCopy className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <Link
                    href={`/admin/links/${createdLink.shortCode}/estatisticas`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-center"
                  >
                    Ver Estatísticas
                  </Link>
                  <button
                    onClick={() => {
                      setCreatedLink(null)
                      router.push('/admin/links')
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Criar Outro Link
                  </button>
                </div>
              </div>
            </div>
          ) : (
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
                  placeholder="Ex: Link para campanha de marketing"
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
                  placeholder="https://meusite.com"
                />
              </div>

              <div>
                <label htmlFor="createdBy" className="block text-sm font-medium text-gray-300 mb-1">
                  Criado por (opcional)
                </label>
                <input
                  type="text"
                  id="createdBy"
                  value={formData.createdBy}
                  onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="seu@email.com"
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
                  placeholder="Anotações sobre este link..."
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

              {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Criando...' : 'Criar Link Rastreável'}
                </button>
                <Link
                  href="/admin/links"
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-center"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
