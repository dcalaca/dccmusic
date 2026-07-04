'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiXCircle, FiArrowRight } from 'react-icons/fi'

function FeaturedFailureContent() {
  const searchParams = useSearchParams()
  const contentType = searchParams.get('contentType')
  const contentId = searchParams.get('contentId')

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
          <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">
            <span className="gradient-text">Pagamento Rejeitado</span>
          </h1>
          <p className="text-gray-300 mb-6">
            O pagamento não foi aprovado. Tente novamente ou entre em contato com o suporte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/compositores/admin"
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Voltar para Área do Compositor
              <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeaturedFailurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    }>
      <FeaturedFailureContent />
    </Suspense>
  )
}
