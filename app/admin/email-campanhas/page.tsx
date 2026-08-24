import Link from 'next/link'
import { FiArrowLeft, FiBarChart2 } from 'react-icons/fi'
import { requireAuth } from '@/lib/auth-helpers'
import EmailCampaignsAdmin from './EmailCampaignsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminEmailCampaignsPage() {
  await requireAuth()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar ao painel
          </Link>
          <Link href="/admin/emails" className="inline-flex items-center gap-2 text-fuchsia-300 hover:text-fuchsia-200">
            <FiBarChart2 /> Controle de e-mails
          </Link>
        </div>
        <EmailCampaignsAdmin />
      </div>
    </div>
  )
}
