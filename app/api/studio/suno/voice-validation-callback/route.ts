import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { translateStudioVoiceError } from '@/lib/studio-voice-errors'

export const dynamic = 'force-dynamic'

function getTaskId(body: any) {
  return body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.task_id
}

function getValidateInfo(body: any) {
  return body?.data?.validateInfo ||
    body?.data?.validate_info ||
    body?.data?.validationPhrase ||
    body?.data?.phrase ||
    body?.validateInfo ||
    null
}

export async function POST(request: Request) {
  try {
    if (!isValidStudioCallback(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const taskId = getTaskId(body)
    const validateInfo = getValidateInfo(body)
    const errorMessage = translateStudioVoiceError(body?.data?.errorMessage || body?.errorMessage || body?.msg || null)

    if (!taskId) {
      return NextResponse.json({ received: true, processed: false, error: 'taskId ausente' })
    }

    const { error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: validateInfo ? 'awaiting_verification' : 'failed',
        validate_info: validateInfo,
        error_message: validateInfo ? null : errorMessage,
        provider_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('validation_task_id', taskId)

    if (error) throw error
    return NextResponse.json({ received: true, processed: true })
  } catch (error: any) {
    console.error('[Studio Voice] Callback validação erro:', error)
    return NextResponse.json({ received: true, processed: false, error: error.message }, { status: 500 })
  }
}
