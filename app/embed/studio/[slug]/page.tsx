import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import StudioPreviewPlayer from '@/components/StudioPreviewPlayer'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'

export const dynamic = 'force-dynamic'

async function getEmbed(slug: string) {
  const { data: project } = await supabaseAdmin
    .from('studio_projects')
    .select('*')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!project) return null

  const [{ data: version }, { data: cover }] = await Promise.all([
    supabaseAdmin.from('studio_versions').select('*').eq('project_id', project.id).eq('is_published', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('studio_covers').select('*').eq('project_id', project.id).eq('is_current', true).maybeSingle(),
  ])

  if (!version) return null
  return { project, version, cover }
}

export default async function StudioEmbedPage({ params }: { params: { slug: string } }) {
  const data = await getEmbed(params.slug)
  if (!data) notFound()

  const versionAudio = await getStudioVersionAudioUrls(data.version)
  const audioUrl = versionAudio.audioUrl || versionAudio.streamAudioUrl

  return (
    <div className="m-0 bg-black text-white">
      <div className="flex gap-4 rounded-2xl border border-gray-800 bg-gray-950 p-4">
        <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gray-900">
          {data.cover?.image_url && <img src={data.cover.image_url} alt={data.project.title} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{data.project.title}</p>
          <p className="mb-3 text-xs text-purple-300">Criado com DCC Studio IA</p>
          {audioUrl && <StudioPreviewPlayer audioUrl={audioUrl} premium />}
        </div>
      </div>
    </div>
  )
}
