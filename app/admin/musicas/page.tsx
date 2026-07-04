import { requireAuth } from '@/lib/auth-helpers'
import * as db from '@/lib/db'
import Link from 'next/link'
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi'
import DeleteMusicButton from '@/components/admin/DeleteMusicButton'

async function getMusics() {
  return db.getMusics({ ordem: 'recentes' })
}

export default async function MusicasPage() {
  await requireAuth()
  const musics = await getMusics()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Músicas</span>
            </h1>
            <p className="text-gray-400">Gerencie as músicas</p>
          </div>
          <Link
            href="/admin/musicas/nova"
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span>Nova Música</span>
          </Link>
        </div>

        {musics.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">Nenhuma música cadastrada ainda.</p>
            <Link
              href="/admin/musicas/nova"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Adicionar primeira música</span>
            </Link>
          </div>
        ) : (
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
                      Plataformas
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
                  {musics.map((music) => (
                    <tr key={music.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{music.title}</div>
                        <div className="text-sm text-gray-400">{music.slug}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {music.genre ? (
                          <span className="px-2 py-1 rounded bg-primary-900/50 text-primary-300 text-xs">
                            {music.genre}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Sem gênero</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {music.spotifyUrl && (
                            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 text-xs">
                              Spotify
                            </span>
                          )}
                          {music.appleMusicUrl && (
                            <span className="px-2 py-1 rounded bg-pink-900/50 text-pink-300 text-xs">
                              Apple
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                        {new Date(music.publishedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {music.featured ? (
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
                            href={`/admin/musicas/${music.id}/editar`}
                            className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                          >
                            <FiEdit className="w-5 h-5" />
                          </Link>
                          <DeleteMusicButton musicId={music.id} musicTitle={music.title} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
