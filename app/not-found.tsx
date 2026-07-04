import Link from 'next/link'
import { FiHome } from 'react-icons/fi'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">
          <span className="gradient-text">404</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">Página não encontrada</p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <FiHome className="w-5 h-5" />
          <span>Voltar para Home</span>
        </Link>
      </div>
    </div>
  )
}
