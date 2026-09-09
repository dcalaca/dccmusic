import { requireAuth } from '@/lib/auth-helpers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FiShield } from 'react-icons/fi'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await requireAuth()
  } catch {
    redirect('/admin/login')
  }

  return (
    <>
      {children}
      <Link
        href="/admin/limpar-metadados"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-gray-700 bg-gray-950/95 px-4 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur transition hover:border-primary-500 hover:text-primary-300"
        title="Limpar metadados de um MP3"
      >
        <FiShield className="h-4 w-4" />
        Limpar metadados
      </Link>
    </>
  )
}
