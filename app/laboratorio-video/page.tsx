import type { Metadata } from 'next'
import VideoLabClient from './video-lab-client'

export const metadata: Metadata = {
  title: 'Laboratório de Vídeo — DCC Music',
  robots: { index: false, follow: false },
}

export default function VideoLabPage() {
  return <VideoLabClient />
}
