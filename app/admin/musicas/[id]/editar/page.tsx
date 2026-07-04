import { requireAuth } from '@/lib/auth-helpers'
import * as db from '@/lib/db'
import { notFound } from 'next/navigation'
import MusicForm from '@/components/admin/MusicForm'

async function getMusic(id: string) {
  try {
    return await db.getMusicById(id)
  } catch {
    return null
  }
}

export default async function EditarMusicaPage({ params }: { params: { id: string } }) {
  await requireAuth()
  const music = await getMusic(params.id)

  if (!music) {
    notFound()
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Editar Música</span>
          </h1>
          <p className="text-gray-400">Edite as informações da música</p>
        </div>

        <MusicForm music={music} />
      </div>
    </div>
  )
}
