import { requireAuth } from '@/lib/auth-helpers'
import PlaybackAdmin from '../playback/PlaybackAdmin'

export const dynamic = 'force-dynamic'

export default async function MurekaPlaybackPage() {
  await requireAuth()
  return <PlaybackAdmin provider="mureka" />
}
