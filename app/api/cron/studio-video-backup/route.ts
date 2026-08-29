import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { backupStudioVideoRequest } from '@/lib/studio-video-backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
