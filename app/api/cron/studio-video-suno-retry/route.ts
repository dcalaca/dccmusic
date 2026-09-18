import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startStudioVideoGeneration } from '@/lib/studio-video'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return !secret || request.headers.get('authorization') === `Bearer ${secret}`
}

// Processa apenas reenvios colocados explicitamente pelo suporte. Falhas do
// provedor nunca entram aqui automaticamente e não acionam o fallback interno.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { data: videos, error } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('status', 'retry_pending')
      .contains('metadata', { force_suno_video_retry: true })
      .order('updated_at', { ascending: true })
      .limit(4)

    if (error) throw error

    const results = []
    for (const video of videos || []) {
      await supabaseAdmin
        .from('studio_video_requests')
        .update({
          metadata: {
            ...(video.metadata || {}),
            force_suno_video_retry: false,
            suno_video_retry_started_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id)

      const retried = await startStudioVideoGeneration(video.id)
      results.push({ videoRequestId: video.id, status: retried?.status || 'unknown' })
    }

    return NextResponse.json({ success: true, retriesChecked: videos?.length || 0, results })
  } catch (error: any) {
    console.error('[CRON STUDIO VIDEO SUNO RETRY] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao reenviar vídeo ao Suno' }, { status: 500 })
  }
}
