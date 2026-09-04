'use client'

import Link from 'next/link'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { useLocalization } from '@/components/LocalizationProvider'

export default function StudioTopupFailurePage() {
  const { country } = useLocalization()
  const isSpanish = ['MX', 'PY', 'CO'].includes(String(country))
  const isEnglish = String(country) === 'US'
  const copy = isEnglish
    ? {
        title: 'Payment declined',
        description: 'This top-up was not completed and no credits were added.',
        explanation: 'If your card was declined, the decision came from the card issuer, not DCC Music. Try another card or check with your bank that online purchases are enabled.',
        action: 'Try again',
      }
    : isSpanish
      ? {
          title: 'Pago rechazado',
          description: 'Esta recarga no se completó y no se agregaron créditos.',
          explanation: 'Si tu tarjeta fue rechazada, la decisión provino del banco emisor, no de DCC Music. Prueba con otra tarjeta o confirma con tu banco que las compras en línea estén habilitadas.',
          action: 'Intentar de nuevo',
        }
      : {
          title: 'Pagamento recusado',
          description: 'Esta recarga não foi concluída e nenhum crédito foi adicionado.',
          explanation: 'Se o cartão foi recusado, a decisão veio do banco emissor, não da DCC Music. Tente outro cartão ou confirme com seu banco se compras online estão liberadas.',
          action: 'Tentar novamente',
        }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md rounded-3xl border border-red-800 bg-red-950/30 p-8 text-center">
          <FiAlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          <h1 className="mb-3 text-3xl font-black">{copy.title}</h1>
          <p className="mb-3 text-gray-200">{copy.description}</p>
          <p className="mb-6 text-sm leading-relaxed text-gray-400">{copy.explanation}</p>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold"
          >
            <FiRefreshCw /> {copy.action}
          </Link>
        </div>
      </div>
    </div>
  )
}
