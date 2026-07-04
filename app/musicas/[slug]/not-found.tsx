import Link from 'next/link'
import { FiHome, FiMusic } from 'react-icons/fi'

export default function MusicNotFound() {
  return (
    <div className="min-h-screen bg-black py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-800 bg-gray-900/60 p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-600/20 text-primary-300">
            <FiMusic className="h-8 w-8" />
          </div>
          <h1 className="mb-3 text-3xl font-bold">
            <span className="gradient-text">Música não encontrada</span>
          </h1>
          <p className="mb-6 text-gray-300">
            Essa música pode ter sido removida, ainda não ter áudio publicado ou o link pode estar escrito diferente.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/musicas"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <FiMusic className="h-4 w-4" />
              Ver músicas publicadas
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-5 py-3 font-semibold text-gray-200 transition-colors hover:border-primary-500 hover:text-primary-300"
            >
              <FiHome className="h-4 w-4" />
              Voltar para Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
