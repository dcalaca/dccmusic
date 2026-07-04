import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'

export const dynamic = 'force-dynamic'

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
      await supabaseAdmin
        .from('studio_video_requests')
        .update({
          response_payload: body,
          error_message: body?.msg || 'Callback sem URL de vídeo.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoRequest.id)

      return NextResponse.json({ received: true, processed: false, error: 'callback sem URL de vídeo' })
    }

    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'completed',
        video_url: videoUrl,
        response_payload: body,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)

    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio IA] Callback vídeo erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
