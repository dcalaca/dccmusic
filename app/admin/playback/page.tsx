import { requireAuth } from '@/lib/auth-helpers'
import PlaybackAdmin from './PlaybackAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminPlaybackPage() {
  await requireAuth()
  return <PlaybackAdmin />
}
