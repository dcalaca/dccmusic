import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getCurrentProjectAssets, getProjectForComposer } from '@/lib/studio'
import {
  getStudioVideoRequestVersionId,
  mapStudioVideoRequest,
  startStudioVideoGeneration,
  studioVideoCanRegenerate,
} from '@/lib/studio-video'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getVersionNumber(versions: any[], versionId: string) {
  const sorted = [...versions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const index = sorted.findIndex((item) => item.id === versionId)
  return index >= 0 ? index + 1 : null
}

async function createVideoRequest(input: {
  composerId: string
  projectId: string
  status: string
  externalReference: string
  paidAt?: string | null
  metadata?: any
}) {
  const { data, error } = await supabaseAdmin
    .from('studio_video_requests')
    .insert({
      composer_id: input.composerId,
      project_id: input.projectId,
      status: input.status,
      amount: 0,
      external_reference: input.externalReference,
      metadata: input.metadata || null,
      paid_at: input.paidAt || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { cover } = await getCurrentProjectAssets(project.id)
    const { data: versions } = await supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .order('created_at', { ascending: false })

    const requestedVersionId = typeof body.versionId === 'string' ? body.versionId.trim() : ''
    const currentVersion = (versions || []).find((item: any) => item.is_current) || versions?.[0] || null
    const version = requestedVersionId
      ? (versions || []).find((item: any) => item.id === requestedVersionId) || null
      : currentVersion

    if (!version) {
      return NextResponse.json(
        { error: requestedVersionId ? 'Versão não encontrada neste projeto.' : 'Finalize a música antes de gerar o vídeo com letra.' },
        { status: 400 }
      )
    }

    if (!version.audio_url && !version.stream_audio_url) {
      return NextResponse.json(
        { error: 'Essa versão ainda não tem áudio para gerar o vídeo com letra.' },
        { status: 400 }
      )
    }

    const { data: existingRequests } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .order('created_at', { ascending: false })
      .limit(30)

    const completedByVersionId = (existingRequests || []).find((item: any) => (
      item.status === 'completed' &&
      (item.video_url || item.video_path) &&
      getStudioVideoRequestVersionId(item) === version.id
    ))
    const untaggedCompleted = (existingRequests || []).find((item: any) => (
      item.status === 'completed' &&
      (item.video_url || item.video_path) &&
      !getStudioVideoRequestVersionId(item)
    ))
    const completedForVersion = completedByVersionId
      || ((Boolean(version.is_current) || Boolean(body.replaceExisting)) ? untaggedCompleted : null)
    const replaceExisting = Boolean(body.replaceExisting)
    const canReplace = Boolean(completedForVersion && studioVideoCanRegenerate(completedForVersion, project))

    if (completedForVersion && !(replaceExisting && canReplace)) {
      return NextResponse.json({
        success: true,
        message: 'Este vídeo com letra já estava pronto para esta versão. Use o botão abaixo para assistir ou baixar.',
        videoRequest: {
          ...(await mapStudioVideoRequest(completedForVersion)),
          canRegenerate: studioVideoCanRegenerate(completedForVersion, project),
        },
      })
    }

    const activeForVersion = (existingRequests || []).find((item: any) => (
      ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(item.status) &&
      getStudioVideoRequestVersionId(item) === version.id
    ))

    if (activeForVersion) {
      return NextResponse.json(
        { error: 'Já existe um vídeo com letra em andamento para esta versão.' },
        { status: 409 }
      )
    }

    const anotherVideoInProduction = (existingRequests || []).find((item: any) => (
      ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(item.status) &&
      getStudioVideoRequestVersionId(item) !== version.id
    ))

    if (anotherVideoInProduction) {
      return NextResponse.json(
        { error: 'Já existe um vídeo com letra em andamento. Aguarde finalizar para gerar o de outra versão.' },
        { status: 409 }
      )
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const versionNumber = getVersionNumber(versions || [], version.id)
    const metadata = {
      type: 'studio_lyric_video',
      composer_id: composer.composerId,
      composer_name: composerData?.name || null,
      project_id: project.id,
      project_title: project.title,
      version_id: version.id,
      version_name: version.version_name || (versionNumber ? `Versão ${versionNumber}` : null),
      version_number: versionNumber,
      music_audio_url: version.audio_url || version.stream_audio_url,
      cover_url: cover?.image_url || null,
      amount: 0,
      courtesy_regenerate: Boolean(replaceExisting && canReplace),
    }

    const reference = `studio-lyric-video:${project.id}:${version.id}:${Date.now()}`
    const videoRequest = await createVideoRequest({
      composerId: composer.composerId,
      projectId: project.id,
      status: 'requested',
      externalReference: reference,
      paidAt: new Date().toISOString(),
      metadata,
    })
    const startedVideoRequest = await startStudioVideoGeneration(videoRequest.id, {
      skipRecover: Boolean(replaceExisting && canReplace),
    })
    const readyNow = startedVideoRequest?.status === 'completed'

    return NextResponse.json({
      success: true,
      message: readyNow
        ? 'Vídeo com letra recuperado com sucesso.'
        : 'Vídeo com letra em produção.',
      videoRequest: await mapStudioVideoRequest(startedVideoRequest),
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro gerar vídeo com letra:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar vídeo com letra' },
      { status: 500 }
    )
  }
}
