'use client'

import Link from 'next/link'
import { FiXCircle, FiArrowLeft } from 'react-icons/fi'

export default function PaymentFailurePage() {
  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <FiXCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">
              <span className="text-red-400">Pagamento Não Aprovado</span>
            </h1>
            <p className="text-gray-400 mb-6">
              O pagamento não foi processado. Por favor, tente novamente ou entre em contato conosco.
            </p>
            <Link
              href="/compositores/planos"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all font-medium"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Voltar para Planos</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
