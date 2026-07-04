'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiPlus, FiEdit, FiTrash2, FiExternalLink, FiEye, FiCopy, FiCheck } from 'react-icons/fi'
import { formatDate } from '@/lib/utils'

interface TrackedLink {
  id: string
  title: string
  destinationUrl: string
  shortCode: string
  trackedUrl: string
  createdBy?: string | null
  notes?: string | null
  expiresAt?: Date | null
  isActive: boolean
  clickCount: number
  createdAt: Date
  updatedAt: Date
}

export default function LinksPage() {
  const [links, setLinks] = useState<TrackedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    // Como estamos na área admin, buscar TODOS os links
    loadAllLinks()
  }, [])

  const loadAllLinks = async () => {
    try {
      setLoading(true)
      // Buscar todos os links (admin tem acesso a todos)
      // Adicionar timestamp para evitar cache
      const response = await fetch(`/api/links/list?all=true&_t=${Date.now()}`)
      
      if (!response.ok) {
        // Se falhar, tentar buscar pelo email do admin
        const adminInfo = await fetch('/api/admin/info').then(res => res.json())
        const email = adminInfo.email || 'admin@dccmusic.com'
        const fallbackResponse = await fetch(`/api/links/list?createdBy=${encodeURIComponent(email)}&_t=${Date.now()}`)
        
        if (!fallbackResponse.ok) {
          throw new Error('Erro ao carregar links')
        }
        
        const data = await fallbackResponse.json()
        setLinks(data)
        return
      }
      
      const data = await response.json()
      setLinks(data)
    } catch (err: any) {
      console.error('Erro ao carregar links:', err)
      setError(err.message || 'Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (shortCode: string, title: string) => {
    if (!confirm(`Tem certeza que deseja deletar o link "${title}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/links/${shortCode}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao deletar link')
      }

      // Recarregar lista
      await loadAllLinks()
    } catch (err: any) {
      alert('Erro ao deletar link: ' + (err.message || 'Erro desconhecido'))
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const toggleActive = async (shortCode: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/links/${shortCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar link')
      }

      // Recarregar lista
      loadAllLinks()
    } catch (err: any) {
      alert('Erro ao atualizar link: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-gray-400">Carregando links...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => loadAllLinks()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
              <span className="gradient-text">Links Rastreáveis</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400">Gerencie seus links e acompanhe os cliques</p>
          </div>
          <Link
            href="/admin/links/novo"
            className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors w-full sm:w-auto"
          >
            <FiPlus className="w-5 h-5" />
            <span>Novo Link</span>
          </Link>
        </div>

        {links.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">Nenhum link rastreável criado ainda.</p>
            <Link
              href="/admin/links/novo"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Criar primeiro link</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Versão Desktop: Tabela */}
            <div className="hidden lg:block bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Link Rastreável
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Destino
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Cliques
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {links.map((link) => (
                      <tr key={link.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 lg:px-6 py-4">
                          <div className="font-medium text-sm lg:text-base">{link.title}</div>
                          {link.notes && (
                            <div className="text-xs lg:text-sm text-gray-400 mt-1">{link.notes}</div>
                          )}
                          {link.expiresAt && (
                            <div className="text-xs text-yellow-400 mt-1">
                              Expira: {new Date(link.expiresAt).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <a
                              href={link.trackedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-400 hover:text-primary-300 text-xs lg:text-sm truncate max-w-xs"
                            >
                              {link.trackedUrl}
                            </a>
                            <button
                              onClick={() => copyToClipboard(link.trackedUrl, link.id)}
                              className="p-1 text-gray-400 hover:text-primary-400 transition-colors flex-shrink-0"
                              title="Copiar link"
                            >
                              {copiedId === link.id ? (
                                <FiCheck className="w-4 h-4 text-green-400" />
                              ) : (
                                <FiCopy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Código: {link.shortCode}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <a
                            href={link.destinationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs lg:text-sm truncate max-w-xs flex items-center space-x-1"
                          >
                            <span className="truncate">{link.destinationUrl}</span>
                            <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/admin/links/${link.shortCode}/estatisticas`}
                            className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                          >
                            <FiEye className="w-4 h-4" />
                            <span className="font-bold">{link.clickCount}</span>
                          </Link>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleActive(link.shortCode, link.isActive)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              link.isActive
                                ? 'bg-green-900/50 text-green-300 hover:bg-green-900/70'
                                : 'bg-red-900/50 text-red-300 hover:bg-red-900/70'
                            }`}
                          >
                            {link.isActive ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-gray-400 text-xs lg:text-sm">
                          {formatDate(link.createdAt)}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-1 lg:space-x-2">
                            <Link
                              href={`/admin/links/${link.shortCode}/estatisticas`}
                              className="p-1.5 lg:p-2 text-gray-400 hover:text-primary-400 transition-colors"
                              title="Ver estatísticas"
                            >
                              <FiEye className="w-4 h-4 lg:w-5 lg:h-5" />
                            </Link>
                            <Link
                              href={`/admin/links/${link.shortCode}/editar`}
                              className="p-1.5 lg:p-2 text-gray-400 hover:text-primary-400 transition-colors"
                              title="Editar"
                            >
                              <FiEdit className="w-4 h-4 lg:w-5 lg:h-5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(link.shortCode, link.title)}
                              className="p-1.5 lg:p-2 text-gray-400 hover:text-red-400 transition-colors"
                              title="Deletar"
                            >
                              <FiTrash2 className="w-4 h-4 lg:w-5 lg:h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Versão Mobile/Tablet: Cards */}
            <div className="lg:hidden space-y-4">
              {links.map((link) => (
                <div key={link.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-base mb-1 truncate">{link.title}</h3>
                      {link.notes && (
                        <p className="text-sm text-gray-400 mb-2 line-clamp-2">{link.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleActive(link.shortCode, link.isActive)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ml-2 ${
                        link.isActive
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {link.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Link Rastreável:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={link.trackedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300 text-xs break-all flex-1"
                        >
                          {link.trackedUrl}
                        </a>
                        <button
                          onClick={() => copyToClipboard(link.trackedUrl, link.id)}
                          className="p-1 text-gray-400 hover:text-primary-400 transition-colors flex-shrink-0"
                          title="Copiar"
                        >
                          {copiedId === link.id ? (
                            <FiCheck className="w-4 h-4 text-green-400" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Código: {link.shortCode}</div>
                    </div>

                    <div>
                      <span className="text-gray-500 text-xs">Destino:</span>
                      <a
                        href={link.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs break-all flex items-center gap-1 mt-1"
                      >
                        <span className="break-all">{link.destinationUrl}</span>
                        <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                      <Link
                        href={`/admin/links/${link.shortCode}/estatisticas`}
                        className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                      >
                        <FiEye className="w-4 h-4" />
                        <span className="font-bold">{link.clickCount} cliques</span>
                      </Link>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/links/${link.shortCode}/editar`}
                          className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                          title="Editar"
                        >
                          <FiEdit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(link.shortCode, link.title)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Deletar"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {link.expiresAt && (
                      <div className="text-xs text-yellow-400">
                        Expira: {new Date(link.expiresAt).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Criado em: {formatDate(link.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
