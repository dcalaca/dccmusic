import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { requireAuth } from '@/lib/auth-helpers'
import BuyersReportPanel from './BuyersReportPanel'

export const dynamic = 'force-dynamic'

export default async function AdminCompradoresPage() {
  await requireAuth()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar ao admin
          </Link>
          <BuyersReportPanel />
        </div>
      </div>
    </div>
  )
}
