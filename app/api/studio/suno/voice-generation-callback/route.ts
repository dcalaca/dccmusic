import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { chargeStudioVoiceCreationOnce, isValidStudioCallback } from '@/lib/studio'
import { translateStudioVoiceError } from '@/lib/studio-voice-errors'

export const dynamic = 'force-dynamic'

function getTaskId(body: any) {
  return body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.task_id
}

function getVoiceId(body: any) {
  return body?.data?.voiceId ||
    body?.data?.voice_id ||
    body?.data?.id ||
    body?.voiceId ||
    body?.voice_id ||
    null
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getTaskId(body)
    const voiceId = getVoiceId(body)
    const status = body?.data?.status || body?.status || null
    const providerCode = Number(body?.code)
    const providerMessage = body?.data?.errorMessage || body?.errorMessage || (providerCode && providerCode !== 200 ? body?.msg : null)
    const errorMessage = translateStudioVoiceError(providerMessage)
    const success = providerCode === 200 || status === 'success'
    const failed = !success && (status === 'fail' || status === 'processing_validate_fail' || Boolean(errorMessage && !voiceId))

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const nextStatus = failed ? 'failed' : success && voiceId ? 'ready' : 'voice_processing'
    const { data: voice, error: voiceError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('id, composer_id, display_name, status, provider_payload')
      .eq('voice_generation_task_id', taskId)
      .maybeSingle()

    if (voiceError) throw voiceError

    const { error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: nextStatus,
        voice_id: voiceId,
        is_available: Boolean(success && voiceId),
        error_message: failed ? errorMessage : null,
        provider_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('voice_generation_task_id', taskId)

    if (error) throw error
    if (voice && voice.status !== 'ready' && nextStatus === 'ready' && !voice.provider_payload?.reactivationFree) {
      await chargeStudioVoiceCreationOnce({
        composerId: voice.composer_id,
        voiceProfileId: voice.id,
        voiceName: voice.display_name,
        taskId,
      })
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio Voice] Callback criação erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
