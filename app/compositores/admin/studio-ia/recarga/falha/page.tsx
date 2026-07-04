'use client'

import Link from 'next/link'
import { FiXCircle, FiRefreshCw } from 'react-icons/fi'

export default function StudioTopupFailurePage() {
  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md rounded-3xl border border-red-800 bg-red-950/30 p-8 text-center">
          <FiXCircle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          <h1 className="mb-3 text-3xl font-black">Pagamento não concluído</h1>
          <p className="mb-6 text-gray-300">
            A recarga não foi liberada. Você pode tentar novamente escolhendo um pacote.
          </p>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold"
          >
            <FiRefreshCw /> Tentar novamente
          </Link>
        </div>
      </div>
    </div>
  )
}
