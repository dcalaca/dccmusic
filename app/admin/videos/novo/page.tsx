import { requireAuth } from '@/lib/auth-helpers'
import VideoForm from '@/components/admin/VideoForm'
import * as db from '@/lib/db'

export default async function NovoVideoPage({ searchParams = {} }: { searchParams?: { composerId?: string } }) {
  await requireAuth()
  const composer = searchParams.composerId ? await db.getComposerById(searchParams.composerId) : null

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Novo Vídeo</span>
          </h1>
          <p className="text-gray-400">Adicione um novo vídeo do YouTube</p>
        </div>

        {composer && (
          <div className="mb-5 rounded-xl border border-primary-800 bg-primary-950/30 p-4 text-sm text-primary-100">
            Lançando vídeo para: <strong>{composer.name}</strong>
          </div>
        )}

        <VideoForm initialComposers={composer ? [composer.name] : []} />
      </div>
    </div>
  )
}
