import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { backupStudioVideoRequest } from '@/lib/studio-video-backup'
import { renderInternalStudioVideo } from '@/lib/studio-video-internal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getVideoTaskId(body: any) {
  return body?.data?.task_id || body?.data?.taskId || body?.task_id || body?.taskId
}

function getVideoUrl(body: any) {
  return body?.data?.video_url || body?.data?.videoUrl || body?.video_url || body?.videoUrl || null
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getVideoTaskId(body)
    const videoUrl = getVideoUrl(body)

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const { data: videoRequest } = await supabaseAdmin
      .from('studio_video_requests')
      .select('*')
      .eq('provider_task_id', taskId)
      .maybeSingle()

    if (!videoRequest) {
      return NextResponse.json({ received: true, processed: false, error: 'solicitação não encontrada' })
    }

    if (!videoUrl) {
      // A Suno aceitou a tarefa, mas não entregou o MP4. A partir daqui o
      // renderizador próprio da DCC assume automaticamente. A marca no metadata
      // evita render duplicado caso o provedor repita o callback e também deixa
      // o cron existente como rede de segurança se a função for interrompida.
      if (videoRequest.metadata?.video_fallback_started_at) {
        return NextResponse.json({
          received: true,
          processed: false,
          fallback: 'dcc-internal',
          fallbackInProgress: true,
        })
      }

      const fallbackStartedAt = new Date().toISOString()
      const { data: fallbackRequest, error: fallbackUpdateError } = await supabaseAdmin
        .from('studio_video_requests')
        .update({
          status: 'requested',
          response_payload: body,
          error_message: null,
          metadata: {
            ...(videoRequest.metadata || {}),
            internal_video_pilot: true,
            video_fallback_provider: 'dcc-internal',
            video_fallback_reason: body?.msg || body?.message || 'Callback da Suno sem URL de vídeo.',
            video_fallback_started_at: fallbackStartedAt,
          },
          updated_at: fallbackStartedAt,
        })
        .eq('id', videoRequest.id)
        .select('*')
        .single()

      if (fallbackUpdateError) throw fallbackUpdateError

      try {
        const internalVideo = await renderInternalStudioVideo(fallbackRequest.id)
        return NextResponse.json({
          received: true,
          processed: true,
          fallback: 'dcc-internal',
          videoReady: internalVideo?.status === 'completed',
        })
      } catch (fallbackError: any) {
        console.error('[Studio IA] Fallback DCC após callback da Suno falhou; retry mantido.', {
          videoRequestId: videoRequest.id,
          error: fallbackError?.message || String(fallbackError),
        })
        return NextResponse.json({
          received: true,
          processed: false,
          fallback: 'dcc-internal',
          fallbackInProgress: true,
        })
      }
    }

    const { data: completedRequest, error: completionError } = await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'completed',
        video_url: videoUrl,
        video_backup_status: 'pending',
        video_backup_error: null,
        response_payload: body,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
      .select('*')
      .single()

    if (completionError) throw completionError

    if (completedRequest) {
      await backupStudioVideoRequest(completedRequest)
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio IA] Callback vídeo erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
