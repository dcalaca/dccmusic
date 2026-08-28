import AutoMusicTitleHelper from './AutoMusicTitleHelper'
import FriendlyAudioDownloads from './FriendlyAudioDownloads'
import ProjectDeleteActions from './ProjectDeleteActions'

export default function StudioIaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AutoMusicTitleHelper />
      <FriendlyAudioDownloads />
      <ProjectDeleteActions />
    </>
  )
}
