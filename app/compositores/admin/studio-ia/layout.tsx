import AutoMusicTitleHelper from './AutoMusicTitleHelper'
import FriendlyAudioDownloads from './FriendlyAudioDownloads'
import USStudioPresetEnhancer from './USStudioPresetEnhancer'

export default function StudioIaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AutoMusicTitleHelper />
      <FriendlyAudioDownloads />
      <USStudioPresetEnhancer />
    </>
  )
}
