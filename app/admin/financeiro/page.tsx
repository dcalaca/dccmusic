import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { requireAuth } from '@/lib/auth-helpers'
import FinancePanel from '../FinancePanel'

export const dynamic = 'force-dynamic'

export default async function AdminFinanceiroPage() {
  await requireAuth()

  return (
    <div className="min-h-screen py-8">
      <style>{`
        .dcc-finance-no-cursor [class~="xl:grid-cols-4"] {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .dcc-finance-no-cursor [class~="xl:grid-cols-4"] > :nth-child(4) {
          display: none;
        }

        .dcc-finance-no-cursor p.text-xs.text-gray-500.mt-4 {
          display: none;
        }
      `}</style>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar ao admin
          </Link>
          <div className="dcc-finance-no-cursor">
            <FinancePanel />
          </div>
        </div>
      </div>
    </div>
  )
}
