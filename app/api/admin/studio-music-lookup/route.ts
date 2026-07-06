import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function cleanCode(value: string | null) {
  return String(value || '').trim()
}

function studioAdminUrl(composerId: string, projectId: string) {
  return `/admin/compositores/${composerId}/studio?project=${projectId}#project-${projectId}`
}

export async function GET(request: NextRequest) {
  await requireAuth()

  const { searchParams } = new URL(request.url)
  const code = cleanCode(searchParams.get('code'))

  if (!code) {
    return NextResponse.json({ error: 'Informe o código da música.' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('studio_projects')
    .select('id, composer_id, title, status')
    .eq('id', code)
    .maybeSingle()

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  if (project?.id && project.composer_id) {
    return NextResponse.json({
      found: true,
      type: 'studio_project',
      title: project.title || 'Projeto Studio IA',
      status: project.status || null,
      targetUrl: studioAdminUrl(project.composer_id, project.id),
    })
  }

  const { data: version, error: versionError } = await supabaseAdmin
    .from('studio_versions')
    .select('id, project_id, composer_id, version_name')
    .eq('id', code)
    .maybeSingle()

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 })
  }

  if (version?.project_id && version.composer_id) {
    return NextResponse.json({
      found: true,
      type: 'studio_version',
      title: version.version_name || 'Música gerada',
      targetUrl: studioAdminUrl(version.composer_id, version.project_id),
    })
  }

  const { data: generation, error: generationError } = await supabaseAdmin
    .from('studio_generations')
    .select('id, project_id, composer_id, provider, provider_task_id, provider_audio_id, status')
    .or(`id.eq.${code},provider_task_id.eq.${code},provider_audio_id.eq.${code}`)
    .maybeSingle()

  if (generationError) {
    return NextResponse.json({ error: generationError.message }, { status: 500 })
  }

  if (generation?.project_id && generation.composer_id) {
    return NextResponse.json({
      found: true,
      type: 'studio_generation',
      title: `Geração ${generation.provider || 'Studio IA'}`,
      status: generation.status || null,
      targetUrl: studioAdminUrl(generation.composer_id, generation.project_id),
    })
  }

  const { data: catalogMusic, error: musicError } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('id, title, slug')
    .eq('id', code)
    .maybeSingle()

  if (musicError) {
    return NextResponse.json({ error: musicError.message }, { status: 500 })
  }

  if (catalogMusic?.id) {
    return NextResponse.json({
      found: true,
      type: 'catalog_music',
      title: catalogMusic.title || 'Música do catálogo',
      targetUrl: `/admin/musicas/${catalogMusic.id}/editar`,
    })
  }

  return NextResponse.json(
    { found: false, error: 'Nenhuma música encontrada com esse código.' },
    { status: 404 }
  )
}
