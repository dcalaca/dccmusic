import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { backupStudioVideoRequest } from '@/lib/studio-video-backup'
import { renderInternalStudioVideo } from '@/lib/studio-video-internal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function rawVideoFailure(video: any) {
  return [
    video?.error_message,
    video?.video_backup_error,
    video?.response_payload?.msg,
    video?.response_payload?.message,
    video?.response_payload?.error?.message,
    video?.metadata?.video_retry_reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isMp4OutageFailure(video: any) {
  const message = rawVideoFailure(video)
  return (
    message.includes('failed to add suno mp4 generation task') ||
    message.includes('temporarily unavailable') ||
    message.includes('try again later')
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Recoloca automaticamente na fila solicitações recentes que ficaram como
    // "failed" durante a indisponibilidade do endpoint MP4 do provedor.
    // Fazemos isso somente para mensagens conhecidas como transitórias para não
    // ressuscitar erros permanentes (versão ausente, dados inválidos etc.).
    const failedCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: recentFailed, error: failedError } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('status', 'failed')
      .gte('created_at', failedCutoff)
      .order('created_at', { ascending: true })
      .limit(50)

    if (failedError) throw failedError

    const outageFailed = (recentFailed || []).filter(isMp4OutageFailure)
    let requeued = 0
    if (outageFailed.length) {
      const outageIds = outageFailed.map((video: any) => video.id)
      const now = new Date().toISOString()
      const { error: requeueError } = await supabaseAdmin
        .from('studio_video_requests')
        .update({
          status: 'retry_pending',
          error_message: null,
          updated_at: now,
        })
        .in('id', outageIds)

      if (requeueError) throw requeueError
      requeued = outageIds.length
      console.log('[CRON STUDIO VIDEO BACKUP] Solicitações MP4 reativadas:', outageIds)
    }

    const retryLimit = 1
    const staleProductionCutoff = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const [{ data: queuedVideos, error: queuedError }, { data: staleVideos, error: staleError }] = await Promise.all([
      supabaseAdmin
        .from('studio_video_requests')
        .select('*')
        .in('status', ['requested', 'retry_pending'])
        .contains('metadata', { internal_video_pilot: true })
        .order('updated_at', { ascending: true })
        .limit(retryLimit),
      supabaseAdmin
        .from('studio_video_requests')
        .select('*')
        .eq('status', 'in_production')
        .contains('metadata', { internal_video_pilot: true })
        .lte('updated_at', staleProductionCutoff)
        .order('updated_at', { ascending: true })
        .limit(retryLimit),
    ])

    if (queuedError) throw queuedError
    if (staleError) throw staleError

    const retryVideos = [...(staleVideos || []), ...(queuedVideos || [])]
      .filter((video, index, list) => list.findIndex((item) => item.id === video.id) === index)
      .slice(0, retryLimit)

    const retryResults = []
    for (const video of retryVideos) {
      try {
        const retried = await renderInternalStudioVideo(video.id)
        retryResults.push({ videoRequestId: video.id, status: retried?.status || 'unknown' })
      } catch (error: any) {
        retryResults.push({ videoRequestId: video.id, status: 'failed', error: error?.message || String(error) })
      }
    }

    const limit = Math.max(1, Math.min(2, Number(request.nextUrl.searchParams.get('limit')) || 1))
    const { data: videos, error } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('status', 'completed')
      .eq('video_backup_status', 'pending')
      .is('video_path', null)
      .not('video_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    const results = []
    for (const video of videos || []) {
      const result = await backupStudioVideoRequest(video)
      results.push({ videoRequestId: video.id, ...result, videoRequest: undefined })
    }

    return NextResponse.json({
      success: true,
      outageFailuresFound: outageFailed.length,
      requeued,
      retriesChecked: retryVideos?.length || 0,
      retryResults,
      checked: videos?.length || 0,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON STUDIO VIDEO BACKUP] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer backup dos vídeos do Studio IA' },
      { status: 500 }
    )
  }
}
