'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VideoCard from '@/components/VideoCard'
import FeaturedButton from '@/components/FeaturedButton'
import { FiPlus, FiEdit, FiTrash2, FiArrowLeft } from 'react-icons/fi'

export default function ComposerVideosPage() {
  const router = useRouter()
  const [composer, setComposer] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login')
      return
    }

    try {
      const data = JSON.parse(composerData)
      setComposer(data)
      loadVideos(data.id)
    } catch (error) {
      router.push('/compositores/login')
    }
  }, [router])

  const loadVideos = async (composerId: string) => {
    try {
      console.log('[PAGE] Carregando vídeos para compositor:', composerId)
      const response = await fetch(`/api/compositores/${composerId}/videos`, {
        cache: 'no-store', // Forçar buscar sempre
      })
      if (response.ok) {
        const data = await response.json()
        console.log('[PAGE] Vídeos recebidos:', data.videos?.length || 0, data.videos)
        setVideos(data.videos || [])
      } else {
        const errorData = await response.json()
        console.error('[PAGE] Erro na resposta:', errorData)
      }
    } catch (error) {
      console.error('[PAGE] Erro ao carregar vídeos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (videoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este vídeo?')) {
      return
    }

    try {
      const token = localStorage.getItem('composer_token')
      const response = await fetch(`/api/compositores/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        setVideos(videos.filter(v => v.id !== videoId))
      } else {
        alert('Erro ao excluir vídeo')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir vídeo')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (!composer) {
    return null
  }

  if (!composer.isPremium) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/compositores/admin"
              className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-6"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>
            <div className="bg-yellow-900/50 border border-yellow-800 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-yellow-300">
                Assinatura Necessária
              </h2>
              <p className="text-gray-400 mb-6">
                Você precisa de uma assinatura ativa para gerenciar seus vídeos.
              </p>
              <Link
                href="/compositores/planos"
                className="inline-block px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
              >
                Ver Planos
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Link
                href="/compositores/admin"
                className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-4"
              >
                <FiArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Link>
              <h1 className="text-4xl font-bold mb-2">
                <span className="gradient-text">Meus Vídeos</span>
              </h1>
              <p className="text-gray-400">
                Gerencie seus vídeos cadastrados
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLoading(true)
                  loadVideos(composer.id)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all font-medium"
              >
                <span>Atualizar</span>
              </button>
              <Link
                href="/compositores/admin/videos/novo"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
              >
                <FiPlus className="w-5 h-5" />
                <span>Novo Vídeo</span>
              </Link>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
              <p className="text-gray-400 mb-6">Você ainda não cadastrou nenhum vídeo.</p>
              <Link
                href="/compositores/admin/videos/novo"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
              >
                <FiPlus className="w-5 h-5" />
                <span>Cadastrar Primeiro Vídeo</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                  <VideoCard video={video} />
                  <div className="p-4 space-y-2">
                    <FeaturedButton
                      contentType="video"
                      contentId={video.id}
                      composerId={composer.id}
                      currentFeatured={video.featured}
                    />
                    <div className="flex gap-2">
                      <Link
                        href={`/compositores/admin/videos/${video.id}/editar`}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                      >
                        <FiEdit className="w-4 h-4" />
                        <span>Editar</span>
                      </Link>
                      <button
                        onClick={() => handleDelete(video.id)}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-900/50 hover:bg-red-800 rounded-lg transition-colors text-sm text-red-300"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
