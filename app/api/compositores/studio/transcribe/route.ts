import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  downloadStudioAudioBuffer,
  validateStudioInputUploadedAsset,
} from '@/lib/studio-audio-backup'
import {
  addStudioCreditTransaction,
  canTranscribeStudioAudioWithCredits,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_TRANSCRIBE_CREDITS,
} from '@/lib/studio'
import { transcribeStudioAudioBuffer, transcribeStudioAudioFile } from '@/lib/studio-transcribe'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_TRANSCRIBE_PER_DAY = 15

async function countTodayTranscriptions(composerId: string) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { count, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('composer_id', composerId)
    .eq('action', 'audio_lyric_transcription')
    .gte('created_at', start.toISOString())

  if (error) {
    console.error('[Studio IA] Erro ao contar transcrições do dia:', error)
    return 0
  }
  return count || 0
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    if (!canTranscribeStudioAudioWithCredits(usage)) {
      return NextResponse.json({
        error: `Entender letra custa ${STUDIO_TRANSCRIBE_CREDITS} crédito. Seu saldo é insuficiente.`,
        creditsRequired: STUDIO_TRANSCRIBE_CREDITS,
        creditsRemaining: usage.remaining,
      }, { status: 402 })
    }

    const usedToday = await countTodayTranscriptions(composer.composerId)
    if (usedToday >= MAX_TRANSCRIBE_PER_DAY) {
      return NextResponse.json({
        error: `Limite diário de ${MAX_TRANSCRIBE_PER_DAY} transcrições atingido. Tente amanhã ou use Melhorar música (a letra entra nos 10 créditos).`,
      }, { status: 429 })
    }

    const contentTypeHeader = request.headers.get('content-type') || ''
    let text = ''

    // Preferido: áudio já no R2 (evita FUNCTION_PAYLOAD_TOO_LARGE)
    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json()
      validateStudioInputUploadedAsset({
        composerId: composer.composerId,
        path: String(body?.audioPath || ''),
        provider: String(body?.audioProvider || 'r2'),
        contentType: String(body?.audioContentType || 'audio/mpeg'),
        sizeBytes: Number(body?.audioSizeBytes) || 0,
      })

      const downloaded = await downloadStudioAudioBuffer(String(body.audioPath), 'r2')
      if (!downloaded) {
        return NextResponse.json({ error: 'Áudio indisponível para transcrição.' }, { status: 404 })
      }

      text = await transcribeStudioAudioBuffer({
        buffer: downloaded.buffer,
        fileName: String(body.audioPath).split('/').pop() || 'audio.mp3',
        contentType: downloaded.contentType || String(body.audioContentType || 'audio/mpeg'),
      })
    } else {
      const formData = await request.formData()
      const file = formData.get('audio')
      if (!(file instanceof File) || file.size <= 0) {
        return NextResponse.json({ error: 'Grave ou envie um áudio antes de transcrever.' }, { status: 400 })
      }
      if (!file.type.startsWith('audio/')) {
        return NextResponse.json({ error: 'Envie um arquivo de áudio válido.' }, { status: 400 })
      }

      text = await transcribeStudioAudioFile(file, file.name || 'gravacao.webm')
    }

    await addStudioCreditTransaction({
      composerId: composer.composerId,
      action: 'audio_lyric_transcription',
      amount: STUDIO_TRANSCRIBE_CREDITS,
      description: 'Entender letra do áudio — 1 crédito',
      metadata: { feature: 'audio_lyric_transcription' },
    })

    return NextResponse.json({
      text,
      creditsCharged: STUDIO_TRANSCRIBE_CREDITS,
      message: `Letra transcrita. Foram debitados ${STUDIO_TRANSCRIBE_CREDITS} crédito.`,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao transcrever áudio:', error)
    const message = error?.message || 'Erro ao transcrever áudio'
    const status =
      /máximo 25 MB|arquivo de áudio|antes de transcrever|encontrar texto|caminho do áudio|provedor|capturar a letra/i.test(message)
        ? 422
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
