import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { backupStudioVideoRequest } from '@/lib/studio-video-backup'
import { startStudioVideoGeneration } from '@/lib/studio-video'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Reenvios para o Suno são inseridos manualmente pelo suporte, com uma
    // marca explícita. Não há retentativa automática nem renderização própria.
    const { data: retryVideos, error: queuedError } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('status', 'retry_pending')
      .contains('metadata', { force_suno_video_retry: true })
      .order('updated_at', { ascending: true })
      .limit(4)

    if (queuedError) throw queuedError

    const retryResults = []
    for (const video of retryVideos) {
      try {
        await supabaseAdmin
          .from('studio_video_requests')
          .update({
            metadata: { ...(video.metadata || {}), force_suno_video_retry: false, suno_video_retry_started_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          })
          .eq('id', video.id)
        const retried = await startStudioVideoGeneration(video.id)
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
      outageFailuresFound: 0,
      requeued: 0,
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
