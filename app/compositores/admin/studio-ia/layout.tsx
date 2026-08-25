import AutoMusicTitleHelper from './AutoMusicTitleHelper'

export default function StudioIaAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AutoMusicTitleHelper />
    </>
  )
}
