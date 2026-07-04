import { requireAuth } from '@/lib/auth-helpers'
import * as db from '@/lib/db'
import Link from 'next/link'
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi'
import DeleteVideoButton from '@/components/admin/DeleteVideoButton'
import AdminVideoFilters from '@/components/admin/AdminVideoFilters'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

interface VideosPageProps {
  searchParams: {
    genero?: string
    ano?: string
    busca?: string
    ordem?: string
    destaque?: string
  }
}

async function getVideos(params: VideosPageProps['searchParams']) {
  const filters: any = {
    ordem: params.ordem || 'recentes', // Sempre ordenar por mais recente por padrão
  }

  if (params.genero) {
    filters.genre = params.genero
  }
  if (params.ano) {
    filters.ano = parseInt(params.ano)
  }
  if (params.busca) {
    filters.busca = params.busca
  }
  if (params.destaque !== undefined) {
    filters.featured = params.destaque === 'true'
  }

  return db.getVideos(filters)
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  await requireAuth()
  const videos = await getVideos(searchParams)
  const genres = await db.getGenres()
  const anos = await db.getVideoYears()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Vídeos</span>
            </h1>
            <p className="text-gray-400">Gerencie os vídeos do YouTube</p>
          </div>
          <div className="flex items-center space-x-3">
            <Suspense fallback={<div className="w-24 h-10 bg-gray-800 rounded-lg animate-pulse" />}>
              <AdminVideoFilters genres={genres} anos={anos} />
            </Suspense>
            <Link
              href="/admin/videos/novo"
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Novo Vídeo</span>
            </Link>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">Nenhum vídeo cadastrado ainda.</p>
            <Link
              href="/admin/videos/novo"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Adicionar primeiro vídeo</span>
            </Link>
          </div>
        ) : (
          <>
            {searchParams.busca || searchParams.genero || searchParams.ano || searchParams.destaque ? (
              <div className="mb-4 text-sm text-gray-400">
                {videos.length} vídeo{videos.length !== 1 ? 's' : ''} encontrado{videos.length !== 1 ? 's' : ''}
              </div>
            ) : null}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Gênero
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Destaque
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {videos.map((video) => (
                    <tr key={video.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{video.title}</div>
                        <div className="text-sm text-gray-400">{video.slug}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {video.genre ? (
                          <span className="px-2 py-1 rounded bg-primary-900/50 text-primary-300 text-xs">
                            {video.genre}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Sem gênero</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                        {new Date(video.publishedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {video.featured ? (
                          <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 text-xs">
                            Sim
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Não</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/admin/videos/${video.id}/editar`}
                            className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                          >
                            <FiEdit className="w-5 h-5" />
                          </Link>
                          <DeleteVideoButton videoId={video.id} videoTitle={video.title} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
