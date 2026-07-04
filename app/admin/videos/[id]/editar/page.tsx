import { requireAuth } from '@/lib/auth-helpers'
import * as db from '@/lib/db'
import { notFound } from 'next/navigation'
import VideoForm from '@/components/admin/VideoForm'

async function getVideo(id: string) {
  try {
    return await db.getVideoById(id)
  } catch {
    return null
  }
}

export default async function EditarVideoPage({ params }: { params: { id: string } }) {
  await requireAuth()
  const video = await getVideo(params.id)

  if (!video) {
    notFound()
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Editar Vídeo</span>
          </h1>
          <p className="text-gray-400">Edite as informações do vídeo</p>
        </div>

        <VideoForm video={video} />
      </div>
    </div>
  )
}
