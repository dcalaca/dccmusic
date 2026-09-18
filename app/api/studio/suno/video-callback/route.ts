import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { backupStudioVideoRequest } from '@/lib/studio-video-backup'
import { refreshHistoricalStudioVideoFromOriginalAudio } from '@/lib/studio-video'
import { addStudioCreditTransaction } from '@/lib/studio'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getVideoTaskId(body: any) {
  return body?.data?.task_id || body?.data?.taskId || body?.task_id || body?.taskId
}

function getVideoUrl(body: any) {
  return body?.data?.video_url || body?.data?.videoUrl || body?.video_url || body?.videoUrl || null
}

async function refundStudioLyricVideoIfCharged(videoRequest: any) {
  const { data: transactions, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, amount, metadata')
    .eq('composer_id', videoRequest.composer_id)
    .eq('action', 'lyric_video_generation')
  if (error) throw error

  const charge = (transactions || []).find((item: any) => item.metadata?.videoRequestId === videoRequest.id)
  if (!charge) return false

  const { data: refunds, error: refundsError } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, metadata')
    .eq('composer_id', videoRequest.composer_id)
    .eq('action', 'lyric_video_refund')
  if (refundsError) throw refundsError
  if ((refunds || []).some((item: any) => item.metadata?.videoRequestId === videoRequest.id)) return false

  await addStudioCreditTransaction({
    composerId: videoRequest.composer_id,
    projectId: videoRequest.project_id,
    action: 'lyric_video_refund',
    amount: Number(charge.amount) || 0,
    description: 'Estorno automático — vídeo com letra não entregue',
    metadata: { feature: 'studio_lyric_video', videoRequestId: videoRequest.id, chargeTransactionId: charge.id },
  })
  return true
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
      const refreshed = await refreshHistoricalStudioVideoFromOriginalAudio(videoRequest.id).catch((error) => {
        console.error('[Studio IA] Erro ao renovar áudio histórico para vídeo:', error)
        return null
      })
      if (refreshed) {
        return NextResponse.json({ received: true, processed: true, refreshedHistoricalAudio: true })
      }

      const refunded = await refundStudioLyricVideoIfCharged(videoRequest)

      // Não produzimos mais o vídeo pelo renderizador interno enquanto o Suno
      // estiver instável. Isso evita custo de transcrição e, principalmente,
      // nunca confirma uma entrega que não existe.
      const { error: unavailableError } = await supabaseAdmin
        .from('studio_video_requests')
        .update({
          status: 'failed',
          response_payload: body,
          error_message: 'O gerador de vídeo com letra está temporariamente indisponível. Tente novamente em alguns minutos.',
          metadata: {
            ...(videoRequest.metadata || {}),
            video_provider_unavailable_at: new Date().toISOString(),
            video_provider_unavailable_reason: body?.msg || body?.message || 'Callback da Suno sem URL de vídeo.',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoRequest.id)
      if (unavailableError) throw unavailableError
      return NextResponse.json({ received: true, processed: true, unavailable: true, refunded })
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
