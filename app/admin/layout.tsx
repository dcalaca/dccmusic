import { requireAuth } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import AdminComposersCountryControls from '@/components/admin/AdminComposersCountryControls'

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
      <AdminComposersCountryControls />
      {children}
    </>
  )
}
