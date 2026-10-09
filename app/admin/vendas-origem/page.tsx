import Link from 'next/link'
import { requireAuth } from '@/lib/auth-helpers'
import SalesOriginsPanel from './SalesOriginsPanel'

export const dynamic = 'force-dynamic'
export default async function SalesOriginsPage() {
  await requireAuth()
  return <div className="container mx-auto px-4 py-8"><Link href="/admin" className="text-primary-400">← Voltar ao admin</Link><SalesOriginsPanel /></div>
}
