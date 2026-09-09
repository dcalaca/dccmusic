import { requireAuth } from '@/lib/auth-helpers'
import AudioMetadataCleaner from './AudioMetadataCleaner'

export default async function LimparMetadadosPage() {
  await requireAuth()

  return <AudioMetadataCleaner />
}
