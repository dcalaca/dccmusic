import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getCurrentProjectAssets, getProjectForComposer } from '@/lib/studio'
import {
  getStudioVideoRequestVersionId,
  isInternalStudioVideoPilot,
  mapStudioVideoRequest,
  startStudioVideoGeneration,
  studioVideoCanRegenerate,
} from '@/lib/studio-video'
import { supabaseAdmin } from '@/lib/supabase'
import {
  addStudioCreditTransaction,
  getStudioAccess,
  getStudioCreditUsage,
} from '@/lib/studio'
import { studioVideoErrorCode } from '@/lib/studio-video-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STUDIO_LYRIC_VIDEO_CREDITS = 5
// Projetos e contas anteriores a esta virada mantêm a expectativa de vídeo
// gratuito. A data fica no servidor para não poder ser manipulada no browser.
const STUDIO_LYRIC_VIDEO_PRICING_STARTED_AT = new Date('2026-09-18T14:00:00.000Z')

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

async function resolveStudioLyricVideoBilling(input: {
  composerId: string
  composerCreatedAt?: string | null
  projectCreatedAt?: string | null
  courtesyRegenerate: boolean
}) {
  if (input.courtesyRegenerate) {
    return { type: 'courtesy_regenerate', credits: 0, label: 'Cortesia de substituição' }
  }

  const projectCreatedAt = input.projectCreatedAt ? new Date(input.projectCreatedAt) : null
  if (projectCreatedAt && projectCreatedAt < STUDIO_LYRIC_VIDEO_PRICING_STARTED_AT) {
    return { type: 'legacy_project', credits: 0, label: 'Projeto criado antes da cobrança' }
  }

  const composerCreatedAt = input.composerCreatedAt ? new Date(input.composerCreatedAt) : null
  if (composerCreatedAt && composerCreatedAt < STUDIO_LYRIC_VIDEO_PRICING_STARTED_AT) {
    const { data: transitionTransactions, error } = await supabaseAdmin
      .from('studio_credit_transactions')
      .select('id, metadata')
      .eq('composer_id', input.composerId)
      .eq('action', 'lyric_video_transition_free')

    if (error) throw error
    if (!(transitionTransactions || []).some((item: any) => item.metadata?.feature === 'studio_lyric_video')) {
      return { type: 'legacy_transition', credits: 0, label: '1º vídeo de transição' }
    }
  }

  return { type: 'paid', credits: STUDIO_LYRIC_VIDEO_CREDITS, label: 'Vídeo com letra' }
}

async function chargeStudioLyricVideoOnce(input: {
  composerId: string
  projectId: string
  videoRequestId: string
  credits: number
}) {
  if (input.credits <= 0) return { charged: false }

  const { data: existing, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, metadata')
    .eq('composer_id', input.composerId)
    .eq('action', 'lyric_video_generation')
  if (error) throw error

  if ((existing || []).some((item: any) => item.metadata?.videoRequestId === input.videoRequestId)) {
    return { charged: false }
  }

  await addStudioCreditTransaction({
    composerId: input.composerId,
    projectId: input.projectId,
    action: 'lyric_video_generation',
    amount: input.credits,
    description: `Vídeo com letra — ${input.credits} créditos`,
    metadata: { feature: 'studio_lyric_video', videoRequestId: input.videoRequestId },
  })
  return { charged: true }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ errorCode: 'projectNotFound' }, { status: 404 })

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
        { errorCode: requestedVersionId ? 'versionNotFound' : 'musicNotReady' },
        { status: 400 }
      )
    }

    if (!version.audio_url && !version.stream_audio_url) {
      return NextResponse.json(
        { errorCode: 'audioNotReady' },
        { status: 400 }
      )
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name, created_at')
      .eq('id', composer.composerId)
      .maybeSingle()
    const isInternalPilot = isInternalStudioVideoPilot(composerData)

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
    // No laboratório, permita refazer o arquivo anterior para que o teste
    // sempre gere um MP4 novo, sem reutilizar o vídeo antigo sem letras.
    const canReplace = Boolean(
      completedForVersion && (isInternalPilot || studioVideoCanRegenerate(completedForVersion, project))
    )

    if (completedForVersion && !(replaceExisting && canReplace)) {
      return NextResponse.json({
        success: true,
        messageCode: 'alreadyReady',
        videoRequest: {
          ...(await mapStudioVideoRequest(completedForVersion)),
          canRegenerate: canReplace,
        },
      })
    }

    const isActiveRequest = (item: any) => (
      ['payment_pending', 'requested', 'in_production', 'retry_pending'].includes(item.status) &&
      !(isInternalPilot && item.status === 'retry_pending')
    )
    const activeForVersion = (existingRequests || []).find((item: any) => (
      isActiveRequest(item) &&
      getStudioVideoRequestVersionId(item) === version.id
    ))

    if (activeForVersion) {
      return NextResponse.json(
        { errorCode: 'versionInProgress' },
        { status: 409 }
      )
    }

    const anotherVideoInProduction = (existingRequests || []).find((item: any) => (
      isActiveRequest(item) &&
      getStudioVideoRequestVersionId(item) !== version.id
    ))

    if (anotherVideoInProduction) {
      return NextResponse.json(
        { errorCode: 'anotherInProgress' },
        { status: 409 }
      )
    }

    // Se o laboratório optar por tentar novamente agora, encerra as tentativas
    // antigas antes de criar a nova. A recuperação automática segue como rede
    // de segurança para quem não estiver com a página aberta.
    if (isInternalPilot) {
      await supabaseAdmin
        .from('studio_video_requests')
        .update({
          status: 'failed',
          error_message: 'Substituída por uma nova tentativa manual.',
          updated_at: new Date().toISOString(),
        })
        .eq('composer_id', composer.composerId)
        .eq('project_id', project.id)
        .eq('status', 'retry_pending')
    }

    const versionNumber = getVersionNumber(versions || [], version.id)
    const courtesyRegenerate = Boolean(replaceExisting && canReplace)
    const billing = await resolveStudioLyricVideoBilling({
      composerId: composer.composerId,
      composerCreatedAt: composerData?.created_at,
      projectCreatedAt: project.created_at,
      courtesyRegenerate,
    })

    if (billing.credits > 0) {
      const { limits } = await getStudioAccess(composer.composerId)
      const usage = await getStudioCreditUsage(composer.composerId, limits)
      if (usage.remaining < billing.credits) {
        return NextResponse.json({
          errorCode: 'insufficientCredits',
          creditsRequired: billing.credits,
          creditsRemaining: usage.remaining,
        }, { status: 402 })
      }
    }

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
      amount: billing.credits,
      billing_type: billing.type,
      billing_label: billing.label,
      courtesy_regenerate: courtesyRegenerate,
      internal_video_pilot: isInternalPilot,
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

    // O render interno pode levar alguns minutos. Responder antes evita que o
    // navegador móvel encerre a conexão e mate a função no meio do FFmpeg. O
    // cron dedicado pega este pedido em até dois minutos e a página acompanha
    // o status por polling.
    if (isInternalPilot) {
      return NextResponse.json({
        success: true,
        messageCode: 'received',
        videoRequest: await mapStudioVideoRequest(videoRequest),
      }, { status: 202 })
    }

    const startedVideoRequest = await startStudioVideoGeneration(videoRequest.id, {
      skipRecover: Boolean(replaceExisting && canReplace),
    })
    if (billing.type === 'legacy_transition') {
      await addStudioCreditTransaction({
        composerId: composer.composerId,
        projectId: project.id,
        action: 'lyric_video_transition_free',
        amount: 0,
        description: 'Cortesia de transição — vídeo com letra',
        metadata: { feature: 'studio_lyric_video', videoRequestId: videoRequest.id },
      })
    } else {
      await chargeStudioLyricVideoOnce({
        composerId: composer.composerId,
        projectId: project.id,
        videoRequestId: videoRequest.id,
        credits: billing.credits,
      })
    }
    const readyNow = startedVideoRequest?.status === 'completed'

    return NextResponse.json({
      success: true,
      messageCode: readyNow
        ? 'recovered'
        : billing.credits > 0
          ? 'inProductionCharged'
          : 'inProduction',
      creditsCharged: billing.credits,
      billingType: billing.type,
      videoRequest: await mapStudioVideoRequest(startedVideoRequest),
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro gerar vídeo com letra:', error)
    return NextResponse.json(
      { errorCode: studioVideoErrorCode(error?.message) || 'failed' },
      { status: 500 }
    )
  }
}
