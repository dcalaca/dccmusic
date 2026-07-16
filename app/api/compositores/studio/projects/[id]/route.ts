import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getCurrentProjectAssets, getProjectForComposer, mapStudioProject } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { backupStudioVersionAudio, getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { formatMusicTitle } from '@/lib/normalize'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30

function getMurekaChoices(result: any) {
  const choices = result?.choices || result?.data?.choices
  return Array.isArray(choices) ? choices : []
}

function normalizeDurationSeconds(value: any) {
  const duration = Number(value) || 0
  if (!duration) return null
  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)
}

async function notifyMusicReady(input: {
  composerId: string
  projectId: string
  projectTitle: string
}) {
  const composer = await getComposerEmailIdentity(input.composerId)
  if (!composer) return

  await sendStudioMusicReadyEmail({
    ...composer,
    projectId: input.projectId,
    projectTitle: input.projectTitle || 'Sua música',
  }).catch((emailError) => {
    console.error('[Studio IA] Erro ao enviar e-mail de música pronta:', emailError)
  })
}

async function backupVersionAudio(versionId: string | null | undefined, composerId: string, audioUrl: string | null, streamAudioUrl: string | null) {
  if (!versionId) return
  await backupStudioVersionAudio({
    versionId,
    composerId,
    audioUrl,
    streamAudioUrl,
  }).catch((backupError) => {
    console.error('[Studio IA] Erro no backup interno do áudio:', backupError)
  })
}

async function syncMurekaGenerationIfReady(project: any, composerId: string) {
  if (!process.env.MUREKA_API_KEY) return

  const { data: currentVersion } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url')
    .eq('project_id', project.id)
    .eq('composer_id', composerId)
    .eq('is_current', true)
    .maybeSingle()

  if (currentVersion?.audio_url || currentVersion?.stream_audio_url) return

  const { data: generation } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('project_id', project.id)
    .eq('composer_id', composerId)
    .eq('provider', 'mureka')
    .in('status', ['pending', 'processing', 'first_ready'])
    .not('provider_task_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!generation?.provider_task_id) return

  const response = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(generation.provider_task_id)}`, {
    headers: {
      Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
    },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  const status = result?.status || result?.data?.status

  if (status !== 'succeeded') {
    if (['failed', 'timeouted', 'cancelled'].includes(status)) {
      await supabaseAdmin
        .from('studio_generations')
        .update({
          status: 'failed',
          error_message: result?.failed_reason || result?.data?.failed_reason || status,
          response_payload: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)
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

  const validChoices = getMurekaChoices(result).filter((choice: any) => (
    choice?.url || choice?.audio_url || choice?.stream_url || choice?.streamAudioUrl
  ))
  if (validChoices.length === 0) return

  await supabaseAdmin
    .from('studio_versions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('project_id', project.id)
    .eq('composer_id', composerId)

  const { data: existingVersions } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url, provider_payload')
    .eq('generation_id', generation.id)

  const savedVersions: Array<{ id: string | null; choice: any }> = []

  for (const [index, choice] of validChoices.entries()) {
    const audioUrl = choice.url || choice.audio_url || null
    const streamAudioUrl = choice.stream_url || choice.streamAudioUrl || audioUrl
    const isCurrent = index === validChoices.length - 1
    const matchingVersion = (existingVersions || []).find((version: any) => (
      (choice?.id && version.provider_payload?.id === choice.id) ||
      (audioUrl && version.audio_url === audioUrl) ||
      (streamAudioUrl && version.stream_audio_url === streamAudioUrl)
    ))

    const versionPayload = {
      audio_url: audioUrl,
      stream_audio_url: streamAudioUrl,
      duration: normalizeDurationSeconds(choice.duration),
      model: result?.model || result?.data?.model || null,
      provider_payload: choice,
      is_current: isCurrent,
      updated_at: new Date().toISOString(),
    }

    let savedVersionId = matchingVersion?.id || null

    if (matchingVersion) {
      const { error } = await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', matchingVersion.id)
      if (error) throw error
    } else {
      const { data: insertedVersion, error } = await supabaseAdmin
        .from('studio_versions')
        .insert({
          project_id: project.id,
          composer_id: composerId,
          generation_id: generation.id,
          version_name: validChoices.length > 1 ? `Música gerada #${index + 1}` : 'Versão IA',
          style: generation.request_payload?.prompt || null,
          ...versionPayload,
        })
        .select('id')
        .maybeSingle()
      if (error) throw error
      savedVersionId = insertedVersion?.id || savedVersionId
    }

    await backupVersionAudio(savedVersionId, composerId, audioUrl, streamAudioUrl)
    savedVersions.push({ id: savedVersionId, choice })
  }

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice

  const [{ error: generationError }, { error: projectError }] = await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: 'completed',
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', project.id),
  ])

  if (generationError) throw generationError
  if (projectError) throw projectError

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

  await notifyMusicReady({
    composerId,
    projectId: project.id,
    projectTitle: project.title || 'Sua música',
  })
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

    const { data: completedVideoRequest } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: latestVideoRequest } = completedVideoRequest
      ? { data: null }
      : await supabaseAdmin
          .from('studio_video_requests')
          .select('*')
          .eq('project_id', project.id)
          .eq('composer_id', composer.composerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

    const videoRequest = completedVideoRequest || latestVideoRequest

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
    const { data: activeGeneration } = await supabaseAdmin
      .from('studio_generations')
      .select('id, status, created_at, updated_at')
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .in('status', shouldSyncLatestGeneration ? ['pending', 'processing', 'first_ready', 'completed'] : ['pending', 'processing', 'first_ready'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const versionAudio = version ? await getStudioVersionAudioUrls(version) : null
    const coverImageUrl = cover ? await getStudioCoverImageUrl(cover) : null
    const versionsWithAudio = await Promise.all((versions || []).map(async (item: any) => {
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
        version: version ? {
          id: version.id,
          audioUrl: versionAudio?.audioUrl,
          streamAudioUrl: versionAudio?.streamAudioUrl,
          duration: version.duration,
          versionName: version.version_name,
          style: version.style,
        } : null,
        versions: versionsWithAudio,
        cover: cover ? {
          id: cover.id,
          imageUrl: coverImageUrl,
          isPremium: cover.is_premium,
        } : null,
        videoRequest: videoRequest ? {
          id: videoRequest.id,
          status: videoRequest.status,
          amount: videoRequest.amount,
          paymentGateway: videoRequest.payment_gateway,
          paymentPreferenceId: videoRequest.payment_preference_id,
          paymentId: videoRequest.payment_id,
          providerTaskId: videoRequest.provider_task_id,
          videoUrl: videoRequest.video_url,
          errorMessage: videoRequest.error_message,
          paidAt: videoRequest.paid_at,
          completedAt: videoRequest.completed_at,
          createdAt: videoRequest.created_at,
          updatedAt: videoRequest.updated_at,
        } : null,
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
