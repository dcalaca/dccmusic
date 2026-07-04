import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { requireAuth } from '@/lib/auth-helpers'
import EmailCampaignsAdmin from './EmailCampaignsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminEmailCampaignsPage() {
  await requireAuth()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
          <FiArrowLeft /> Voltar ao painel
        </Link>
        <EmailCampaignsAdmin />
      </div>
    </div>
  )
}
