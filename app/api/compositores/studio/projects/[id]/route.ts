import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getCurrentProjectAssets, getProjectForComposer, mapStudioProject } from '@/lib/studio'
import { isInternalStudioVideoPilot, mapStudioVideoRequest, studioVideoCanRegenerate } from '@/lib/studio-video'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { formatMusicTitle } from '@/lib/normalize'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import {
  countGenerationVersions,
  extractMurekaChoicesFromPayload,
  MUREKA_TRACKS_PER_GENERATION,
  saveMurekaGenerationTracksEnsuringTwo,
} from '@/lib/studio-mureka-versions'
import {
  isStudioGenerationTimedOut,
  markStudioGenerationAsCommunicationFailure,
  releaseStudioProjectFromFailedGeneration,
  STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
} from '@/lib/studio-generation-timeout'

export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30

async function notifyMusicReady(input: {
  composerId: string
  projectId: string
  projectTitle: string
  generationId?: string | null
}) {
  const composer = await getComposerEmailIdentity(input.composerId)
  if (!composer) return

  await sendStudioMusicReadyEmail({
    ...composer,
    projectId: input.projectId,
    generationId: input.generationId || null,
    projectTitle: input.projectTitle || 'Sua música',
  }).catch((emailError) => {
    console.error('[Studio IA] Erro ao enviar e-mail de música pronta:', emailError)
  })
}

async function syncMurekaGenerationIfReady(project: any, composerId: string) {
  if (!process.env.MUREKA_API_KEY) return

  const { data: generation } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('project_id', project.id)
    .eq('composer_id', composerId)
    .eq('provider', 'mureka')
    .in('status', ['pending', 'processing', 'first_ready', 'completed'])
    .not('provider_task_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!generation?.provider_task_id) return

  const versionCount = await countGenerationVersions(generation.id)
  const needsTwoTracks = versionCount < MUREKA_TRACKS_PER_GENERATION
  const isOpen = ['pending', 'processing', 'first_ready'].includes(generation.status)

  if (!needsTwoTracks && generation.status === 'completed') return
  if (!isOpen && !needsTwoTracks) return

  if (isOpen && isStudioGenerationTimedOut(generation) && versionCount === 0) {
    await markStudioGenerationAsCommunicationFailure(generation)
    return
  }

  let result: any = null
  try {
    const response = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(generation.provider_task_id)}`, {
      headers: {
        Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    result = await response.json().catch(() => null)
    if (!response.ok) return
  } catch (error) {
    console.warn('[Studio IA] Consulta Mureka indisponível ao abrir projeto; mantendo estado atual.', error)
    return
  }

  const status = result?.status || result?.data?.status

  if (status !== 'succeeded' && status !== 'streaming') {
    if (['failed', 'timeouted', 'cancelled'].includes(status)) {
      await supabaseAdmin
        .from('studio_generations')
        .update({
          status: 'failed',
          error_message: STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
          response_payload: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)
      await releaseStudioProjectFromFailedGeneration(generation.project_id)
    } else if (result) {
      await supabaseAdmin
        .from('studio_generations')
        .update({
          response_payload: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)
    }
    return
  }

  const choices = extractMurekaChoicesFromPayload(result)
  const wantsComplete = status === 'succeeded'
  const { savedVersions, hasExactTwo } = await saveMurekaGenerationTracksEnsuringTwo({
    generation,
    choices,
    isComplete: wantsComplete,
    model: result?.model || result?.data?.model || null,
  })
  if (savedVersions.length === 0) return

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice
  const fullyReady = wantsComplete && hasExactTwo

  const [{ error: generationError }, { error: projectError }] = await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: fullyReady ? 'completed' : 'first_ready',
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({
        status: fullyReady ? 'ready' : 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id),
  ])

  if (generationError) throw generationError
  if (projectError) throw projectError

  if (!fullyReady) {
    console.warn('[Studio IA] Mureka sem 2 versões no sync do projeto; mantendo generating', {
      generationId: generation.id,
      saved: savedVersions.length,
    })
    return
  }

  await ensureSimpleStudioCover({
    projectId: project.id,
    composerId,
    title: project.title || 'Sua música',
    style: project.style,
    mood: project.mood,
    description: project.description,
    replaceCurrent: true,
  }).catch((coverError) => {
    console.error('[Studio IA] Erro ao criar capa simples:', coverError)
  })

  if (generation.status !== 'completed') {
    await notifyMusicReady({
      composerId,
      projectId: project.id,
      generationId: generation.id,
      projectTitle: project.title || 'Sua música',
    })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const project = await getProjectForComposer(params.id, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    await syncMurekaGenerationIfReady(project, composer.composerId)

    const { lyric, version, cover } = await getCurrentProjectAssets(project.id)
    const { data: versions } = await supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .order('created_at', { ascending: false })

    const { data: videoRequests } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .order('created_at', { ascending: false })
      .limit(30)

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email')
      .eq('id', composer.composerId)
      .maybeSingle()
    const isInternalPilot = isInternalStudioVideoPilot(composerData)

    const mappedVideoRequests = (await Promise.all((videoRequests || [])
      .map(async (item: any) => {
        const mapped = await mapStudioVideoRequest(item)
        if (!mapped) return null
        return {
          ...mapped,
          // No laboratório, a retentativa automática continua existindo no
          // servidor, mas não deve prender o botão do usuário por vários
          // minutos. A interface permite disparar uma nova tentativa na hora.
          status: isInternalPilot && mapped.status === 'retry_pending'
            ? 'failed'
            : mapped.status,
          canRegenerate: isInternalPilot || studioVideoCanRegenerate(item, project),
        }
      })))
      .filter(Boolean)
    const completedVideoRequest = mappedVideoRequests.find((item: any) => item.status === 'completed' && item.videoUrl) || null
    const videoRequest = completedVideoRequest || mappedVideoRequests[0] || null

    const { data: inspirationRequest } = await supabaseAdmin
      .from('studio_inspiration_requests')
      .select('*')
      .eq('composer_id', composer.composerId)
      .eq('target_project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: inspirationSourceProject } = inspirationRequest?.source_project_id
      ? await supabaseAdmin
          .from('studio_projects')
          .select('id, title, style, mood, status')
          .eq('id', inspirationRequest.source_project_id)
          .eq('composer_id', composer.composerId)
          .maybeSingle()
      : { data: null }

    const shouldSyncLatestGeneration = !version?.audio_url
    let { data: activeGeneration } = await supabaseAdmin
      .from('studio_generations')
      .select('id, status, created_at, updated_at, project_id')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .in('status', shouldSyncLatestGeneration ? ['pending', 'processing', 'first_ready', 'completed'] : ['pending', 'processing', 'first_ready'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeGeneration && isStudioGenerationTimedOut(activeGeneration)) {
      const { data: generationVersion } = await supabaseAdmin
        .from('studio_versions')
        .select('id, audio_url, stream_audio_url')
        .eq('generation_id', activeGeneration.id)
        .limit(1)
        .maybeSingle()

      if (!generationVersion?.audio_url && !generationVersion?.stream_audio_url) {
        await markStudioGenerationAsCommunicationFailure(activeGeneration)
        activeGeneration = null
        const { data: refreshedProject } = await supabaseAdmin
          .from('studio_projects')
          .select('status')
          .eq('id', project.id)
          .maybeSingle()
        if (refreshedProject?.status) {
          project.status = refreshedProject.status
        }
      }
    }

    // A rota de leitura nunca faz download, reparo ou deduplicação de áudio.
    // Essas operações pertencem ao callback/fila/cron, para que abrir um projeto
    // continue rápido mesmo quando um fornecedor externo estiver lento ou fora.
    const availableVersions = versions || []

    const currentVersion = availableVersions.find((item: any) => item.is_current) || availableVersions[0] || version
    const versionAudio = currentVersion ? await getStudioVersionAudioUrls(currentVersion) : null
    const coverImageUrl = cover ? await getStudioCoverImageUrl(cover) : null
    const versionsWithAudio = await Promise.all(availableVersions.map(async (item: any) => {
      const audio = await getStudioVersionAudioUrls(item)
      return {
        id: item.id,
        audioUrl: audio.audioUrl,
        streamAudioUrl: audio.streamAudioUrl,
        duration: item.duration,
        versionName: item.version_name,
        style: item.style,
        model: item.model,
        isCurrent: Boolean(item.is_current),
        isPublished: Boolean(item.is_published),
        createdAt: item.created_at,
      }
    }))

    return NextResponse.json({
      project: mapStudioProject(project, {
        lyric: lyric?.content || '',
        version: currentVersion ? {
          id: currentVersion.id,
          audioUrl: versionAudio?.audioUrl,
          streamAudioUrl: versionAudio?.streamAudioUrl,
          duration: currentVersion.duration,
          versionName: currentVersion.version_name,
          style: currentVersion.style,
        } : null,
        versions: versionsWithAudio,
        cover: cover ? {
          id: cover.id,
          imageUrl: coverImageUrl,
          isPremium: cover.is_premium,
        } : null,
        videoRequest,
        videoRequests: mappedVideoRequests,
        inspiration: inspirationRequest ? {
          id: inspirationRequest.id,
          status: inspirationRequest.status,
          sourceProjectId: inspirationRequest.source_project_id,
          sourceVersionId: inspirationRequest.source_version_id,
          sourceTitle: inspirationSourceProject?.title || inspirationRequest.request_payload?.sourceTitle || 'Projeto de inspiração',
          sourceStyle: inspirationSourceProject?.style || inspirationRequest.request_payload?.sourceStyle || null,
          sourceMood: inspirationSourceProject?.mood || inspirationRequest.request_payload?.sourceMood || null,
          variation: inspirationRequest.request_payload?.variation || 'similar',
          variationLabel: inspirationRequest.request_payload?.variationLabel || 'Manter parecido',
          providerTaskId: inspirationRequest.provider_task_id,
          createdAt: inspirationRequest.created_at,
        } : null,
      }),
      activeGeneration: activeGeneration ? {
        id: activeGeneration.id,
        status: activeGeneration.status,
        createdAt: activeGeneration.created_at,
        updatedAt: activeGeneration.updated_at,
      } : null,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro buscar projeto:', error)
    return NextResponse.json({ error: error.message || 'Erro ao buscar projeto' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const project = await getProjectForComposer(params.id, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const body = await request.json()
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body.title === 'string') updates.title = formatMusicTitle(body.title.trim().slice(0, STUDIO_TITLE_MAX_LENGTH))
    if (typeof body.style === 'string') updates.style = body.style
    if (typeof body.mood === 'string') updates.mood = body.mood
    if (typeof body.structure === 'string') updates.structure = body.structure
    if (typeof body.lineCount === 'string') updates.line_count = body.lineCount
    if (typeof body.description === 'string') updates.description = body.description
    if (typeof body.favorite === 'boolean') updates.favorite = body.favorite

    const { data, error } = await supabaseAdmin
      .from('studio_projects')
      .update(updates)
      .eq('id', params.id)
      .eq('composer_id', composer.composerId)
      .select('*')
      .single()

    if (error) throw error

    if (typeof body.lyric === 'string') {
      await supabaseAdmin
        .from('studio_lyrics')
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq('project_id', params.id)
        .eq('composer_id', composer.composerId)

      await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: params.id,
          composer_id: composer.composerId,
          content: body.lyric,
          is_current: true,
        })
    }

    return NextResponse.json({ project: mapStudioProject(data) })
  } catch (error: any) {
    console.error('[Studio IA] Erro atualizar projeto:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar projeto' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const project = await getProjectForComposer(params.id, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    if (project.status !== 'draft') {
      return NextResponse.json(
        { error: 'Só é possível descartar rascunhos. Músicas prontas ou publicadas não são apagadas por aqui.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('studio_projects')
      .delete()
      .eq('id', params.id)
      .eq('composer_id', composer.composerId)
      .eq('status', 'draft')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Studio IA] Erro descartar rascunho:', error)
    return NextResponse.json({ error: error.message || 'Erro ao descartar rascunho' }, { status: 500 })
  }
}
