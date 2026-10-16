import { requireAuth } from '@/lib/auth-helpers'
import ProspectAdmin from './ProspectAdmin'
export const dynamic = 'force-dynamic'
export default async function Page() { await requireAuth(); return <ProspectAdmin /> }
