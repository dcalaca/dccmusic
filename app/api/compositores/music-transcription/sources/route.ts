import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VERSION_SELECT = `
  id,
  project_id,
  version_name,
  duration,
  created_at,
  is_current,
  audio_url,
  stream_audio_url,
  audio_path,
  stream_audio_path,
  audio_storage_provider,
  stream_audio_storage_provider,
  project:studio_projects(id, title, updated_at, status)
`

function cleanStudioMusicTitle(value?: string | null) {
  const title = String(value || '').trim()
  if (!title) return 'Música Studio IA'

  const [firstPart, ...rest] = title.split(' - ')
  const details = rest.join(' - ').toLowerCase()

  if (
    firstPart?.trim() &&
    (
      details.includes('música gerada') ||
      details.includes('versão') ||
      details.includes('clima ') ||
      details.includes('produção ') ||
      details.includes('vocal ') ||
      details.includes('mixagem ') ||
      details.includes('sertanejo') ||
      details.includes('pagode') ||
      details.includes('funk') ||
      details.includes('mpb') ||
      details.includes('forró') ||
      details.includes('gospel')
    )
  ) {
    return firstPart.trim()
  }

  return title
}

function hasRawAudioReference(version: any) {
  return Boolean(
    String(version?.audio_url || '').trim() ||
    String(version?.stream_audio_url || '').trim() ||
    String(version?.audio_path || '').trim() ||
    String(version?.stream_audio_path || '').trim()
  )
}

function getProjectFromVersion(version: any) {
  return Array.isArray(version.project) ? version.project[0] : version.project
}

async function fetchVersionById(composerId: string, versionId: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_versions')
    .select(VERSION_SELECT)
    .eq('id', versionId)
    .eq('composer_id', composerId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function mapVersionToSource(version: any, projectUpdatedAt?: string | null) {
  if (!hasRawAudioReference(version)) return null

  const audio = await getStudioVersionAudioUrls(version)
  if (!audio.audioUrl && !audio.streamAudioUrl) return null

  const project = getProjectFromVersion(version)
  const sortDate = projectUpdatedAt || project?.updated_at || version.created_at || null

  return {
    id: version.id,
    projectId: version.project_id,
    title: cleanStudioMusicTitle(project?.title || version.version_name),
    versionName: version.version_name || 'Versão gerada',
    duration: version.duration || null,
    createdAt: version.created_at,
    projectUpdatedAt: sortDate,
    isCurrent: Boolean(version.is_current),
  }
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const preferredVersionId = searchParams.get('studioVersionId')?.trim() || ''
    const preferredProjectId = searchParams.get('studioProjectId')?.trim() || ''

    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('studio_projects')
      .select('id, title, updated_at, status')
      .eq('composer_id', composer.composerId)
      .in('status', ['ready', 'published', 'generating'])
      .order('updated_at', { ascending: false })
      .limit(120)

    if (projectsError) throw projectsError

    const projectMap = new Map((projects || []).map((project) => [project.id, project]))
    const projectIds = new Set((projects || []).map((project) => project.id))

    if (preferredProjectId) projectIds.add(preferredProjectId)

    if (preferredVersionId) {
      const preferredVersion = await fetchVersionById(composer.composerId, preferredVersionId)
      if (preferredVersion?.project_id) {
        projectIds.add(preferredVersion.project_id)
      }
    }

    let versions: any[] = []
    if (projectIds.size > 0) {
      const { data, error } = await supabaseAdmin
        .from('studio_versions')
        .select(VERSION_SELECT)
        .eq('composer_id', composer.composerId)
        .in('project_id', Array.from(projectIds))
        .order('created_at', { ascending: false })

      if (error) throw error
      versions = data || []
    }

    if (preferredVersionId && !versions.some((version) => version.id === preferredVersionId)) {
      const preferredVersion = await fetchVersionById(composer.composerId, preferredVersionId)
      if (preferredVersion) {
        versions.unshift(preferredVersion)
        const preferredProject = getProjectFromVersion(preferredVersion)
        if (preferredProject?.id && !projectMap.has(preferredProject.id)) {
          projectMap.set(preferredProject.id, preferredProject)
        }
      }
    }

    const mappedSources = await Promise.all(
      versions.map(async (version) => {
        const project = projectMap.get(version.project_id) || getProjectFromVersion(version)
        return mapVersionToSource(version, project?.updated_at || null)
      })
    )

    const sources = mappedSources
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = new Date(a!.projectUpdatedAt || a!.createdAt || 0).getTime()
        const dateB = new Date(b!.projectUpdatedAt || b!.createdAt || 0).getTime()
        if (dateB !== dateA) return dateB - dateA
        if (Boolean(b!.isCurrent) !== Boolean(a!.isCurrent)) return Number(b!.isCurrent) - Number(a!.isCurrent)
        return new Date(b!.createdAt || 0).getTime() - new Date(a!.createdAt || 0).getTime()
      })

    return NextResponse.json({ sources })
  } catch (error: any) {
    console.error('[Music Transcription] Erro listar fontes:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar suas músicas.' },
      { status: 500 }
    )
  }
}
