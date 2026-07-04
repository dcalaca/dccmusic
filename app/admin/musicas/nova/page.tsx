import { requireAuth } from '@/lib/auth-helpers'
import MusicForm from '@/components/admin/MusicForm'
import * as db from '@/lib/db'

export default async function NovaMusicaPage({ searchParams = {} }: { searchParams?: { composerId?: string } }) {
  await requireAuth()
  const composer = searchParams.composerId ? await db.getComposerById(searchParams.composerId) : null

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Nova Música</span>
          </h1>
          <p className="text-gray-400">Adicione uma nova música</p>
        </div>

        {composer && (
          <div className="mb-5 rounded-xl border border-primary-800 bg-primary-950/30 p-4 text-sm text-primary-100">
            Lançando música para: <strong>{composer.name}</strong>
          </div>
        )}

        <MusicForm initialComposers={composer ? [composer.name] : []} />
      </div>
    </div>
  )
}
