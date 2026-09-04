import AdminComposerPhotoPortal from './AdminComposerPhotoPortal'

export default function AdminComposersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminComposerPhotoPortal />
    </>
  )
}
