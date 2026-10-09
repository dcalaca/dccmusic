import { supabaseAdmin } from '@/lib/supabase'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'

export async function getEligibleStudioFeaturedMusic(projectId: string, composerId?: string) {
  let query = supabaseAdmin.from('studio_projects').select('id,composer_id,title,style,status,public_slug,published_at')
    .eq('id', projectId).eq('status', 'published').not('public_slug', 'is', null)
  if (composerId) query = query.eq('composer_id', composerId)
  const { data: project, error } = await query.maybeSingle()
  if (error) throw error
  if (!project) return null
  const [versions, lyrics] = await Promise.all([
    supabaseAdmin.from('studio_versions').select('id,audio_url,stream_audio_url')
      .eq('project_id', project.id).eq('is_published', true).order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('studio_lyrics').select('id,content').eq('project_id', project.id).eq('is_current', true).limit(1),
  ])
  if (versions.error) throw versions.error
  if (lyrics.error) throw lyrics.error
  if (!versions.data?.some(v => Boolean(v.audio_url || v.stream_audio_url)) || !lyrics.data?.some(l => Boolean(l.content?.trim()))) return null
  return project
}

export async function getStudioFeaturedMusicCard(projectId: string) {
  const project = await getEligibleStudioFeaturedMusic(projectId)
  if (!project?.public_slug) return null
  const { data: covers } = await supabaseAdmin.from('studio_covers').select('*')
    .eq('project_id', project.id).order('created_at', { ascending: false }).limit(5)
  const cover = covers?.find(item => item.is_current) || covers?.[0] || null
  const coverUrl = cover ? await getStudioCoverImageUrl(cover) : null
  return {
    id: project.id, title: project.title, slug: project.public_slug, href: `/studio/${project.public_slug}`,
    genre: project.style || null, spotifyUrl: null, coverUrl: coverUrl || null,
    publishedAt: new Date(project.published_at || Date.now()), viewCount: 0,
    sourceLabel: 'Studio IA',
  }
}
