import { requireAuth } from '@/lib/auth-helpers'
import ResendMetricsPanel from './ResendMetricsPanel'
export const dynamic = 'force-dynamic'
export default async function ResendMetricsPage() {
  await requireAuth()
  return <ResendMetricsPanel />
}
