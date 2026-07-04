import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getCurrentProjectAssets, getProjectForComposer } from '@/lib/studio'
import { startStudioVideoGeneration } from '@/lib/studio-video'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

    const { version, cover } = await getCurrentProjectAssets(project.id)
    if (!version?.audio_url && !version?.stream_audio_url) {
      return NextResponse.json(
        { error: 'Finalize a música antes de gerar o vídeo com letra.' },
        { status: 400 }
      )
    }

    const { data: activeRequest } = await supabaseAdmin
      .from('studio_video_requests')
      .select('id, status')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .in('status', ['payment_pending', 'requested', 'in_production'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeRequest) {
      return NextResponse.json(
        { error: 'Já existe um vídeo com letra em andamento para esta música.' },
        { status: 409 }
      )
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const metadata = {
      type: 'studio_lyric_video',
      composer_id: composer.composerId,
      composer_name: composerData?.name || null,
      project_id: project.id,
      project_title: project.title,
      music_audio_url: version.audio_url || version.stream_audio_url,
      cover_url: cover?.image_url || null,
      amount: 0,
    }

    const reference = `studio-lyric-video:${project.id}:${Date.now()}`
    const videoRequest = await createVideoRequest({
      composerId: composer.composerId,
      projectId: project.id,
      status: 'requested',
      externalReference: reference,
      paidAt: new Date().toISOString(),
      metadata,
    })
    const startedVideoRequest = await startStudioVideoGeneration(videoRequest.id)

    return NextResponse.json({
      success: true,
      message: 'Vídeo com letra em produção.',
      videoRequest: startedVideoRequest,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro gerar vídeo com letra:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar vídeo com letra' },
      { status: 500 }
    )
  }
}
