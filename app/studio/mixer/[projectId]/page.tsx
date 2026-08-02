import StudioPage from '@/components/studio/StudioPage'

type StudioMixerProjectPageProps = {
  params: { projectId: string }
}

export default function StudioMixerProjectPage({ params }: StudioMixerProjectPageProps) {
  return <StudioPage projectId={params.projectId} />
}
