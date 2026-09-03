import AutoMusicTitleHelper from './AutoMusicTitleHelper'
import FriendlyAudioDownloads from './FriendlyAudioDownloads'

export default function StudioIaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AutoMusicTitleHelper />
      <FriendlyAudioDownloads />
    </>
  )
}
