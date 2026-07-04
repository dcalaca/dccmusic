import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { chargeStudioVoiceCreationOnce } from '@/lib/studio'
import { createStudioVoiceAssetUrl, uploadStudioVoiceAsset, validateStudioVoiceUploadedAsset } from '@/lib/studio-voice-assets'
import { checkSunoVoiceAvailability, createSunoCustomVoice, createSunoVoiceValidation, getSunoVoiceRecordInfo, getSunoVoiceValidationInfo } from '@/lib/suno-voice'
import { isStudioVoiceExpiredError, translateStudioVoiceError, VOICE_PROCESSING_ERROR_MESSAGE } from '@/lib/studio-voice-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extractValidateInfo(payload: any) {
  return payload?.data?.validateInfo ||
    payload?.data?.validate_info ||
    payload?.data?.validationPhrase ||
    payload?.data?.phrase ||
    payload?.validateInfo ||
    null
}

function extractVoiceId(payload: any) {
  return payload?.data?.voiceId ||
    payload?.data?.voice_id ||
    payload?.data?.id ||
    payload?.voiceId ||
    payload?.voice_id ||
    null
}

async function getVoice(id: string, composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_voice_profiles')
    .select('*')
    .eq('id', id)
    .eq('composer_id', composerId)
    .neq('status', 'archived')
    .maybeSingle()

  if (error) throw error
  return data
}

async function mapVoice(row: any) {
  const [sourceAudioUrl, verifyAudioUrl] = await Promise.all([
    createStudioVoiceAssetUrl(row.source_audio_path, row.source_audio_storage_provider).catch(() => null),
    createStudioVoiceAssetUrl(row.verify_audio_path, row.verify_audio_storage_provider).catch(() => null),
  ])

  return {
    id: row.id,
    displayName: row.display_name,
    status: row.status,
    vocalStartS: row.vocal_start_s,
    vocalEndS: row.vocal_end_s,
    validateInfo: row.validate_info,
    voiceId: row.voice_id,
    isAvailable: Boolean(row.is_available),
    errorMessage: translateStudioVoiceError(row.error_message),
    sourceAudioUrl,
    verifyAudioUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { action } = await request.json().catch(() => ({ action: 'refresh' }))
    const voice = await getVoice(params.id, composer.composerId)
    if (!voice) return NextResponse.json({ error: 'Voz não encontrada' }, { status: 404 })

    if (!['refresh', 'regenerate-validation', 'reactivate-expired'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    let updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'reactivate-expired') {
      const expiredVoiceError = isStudioVoiceExpiredError(voice.error_message) ||
        String(voice.error_message || '').toLowerCase().includes('expir')
      const canReactivateReadyVoice = voice.status === 'ready' && voice.source_audio_path && voice.verify_audio_path
      if (!expiredVoiceError && !canReactivateReadyVoice) {
        return NextResponse.json({ error: 'Essa ação só está disponível para vozes expiradas ou já criadas anteriormente.' }, { status: 400 })
      }
      if (!voice.source_audio_path) {
        return NextResponse.json({ error: 'Áudio base não encontrado para reativar essa voz.' }, { status: 400 })
      }
      const voiceUrl = await createStudioVoiceAssetUrl(voice.source_audio_path, voice.source_audio_storage_provider)
      if (!voiceUrl) throw new Error('Não foi possível preparar o áudio salvo da voz.')

      const validation = await createSunoVoiceValidation({
        voiceUrl,
        vocalStartS: Number(voice.vocal_start_s) || 0,
        vocalEndS: Math.max((Number(voice.vocal_start_s) || 0) + 1, Number(voice.vocal_end_s) || 20),
        language: voice.language || 'pt',
      })

      updatePayload = {
        ...updatePayload,
        status: 'validation_processing',
        voice_id: null,
        is_available: false,
        validation_task_id: validation?.data?.taskId || null,
        validate_info: null,
        voice_generation_task_id: null,
        error_message: null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          reactivationFree: true,
          voiceReactivation: {
            validation,
            at: new Date().toISOString(),
          },
        },
      }
    } else if (action === 'regenerate-validation') {
      if (!voice.source_audio_path) {
        return NextResponse.json({ error: 'Áudio base não encontrado para gerar nova frase.' }, { status: 400 })
      }

      const voiceUrl = await createStudioVoiceAssetUrl(voice.source_audio_path, voice.source_audio_storage_provider)
      if (!voiceUrl) throw new Error('Não foi possível preparar o áudio para validação.')

      const validation = await createSunoVoiceValidation({
        voiceUrl,
        vocalStartS: Number(voice.vocal_start_s) || 0,
        vocalEndS: Math.max((Number(voice.vocal_start_s) || 0) + 1, Number(voice.vocal_end_s) || 20),
        language: voice.language || 'pt',
      })

      updatePayload = {
        ...updatePayload,
        status: 'validation_processing',
        validation_task_id: validation?.data?.taskId || null,
        validate_info: null,
        error_message: null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          validationRegenerated: validation,
        },
      }
    } else if (voice.validation_task_id && ['validation_processing', 'source_uploaded'].includes(voice.status)) {
      const validationInfo = await getSunoVoiceValidationInfo(voice.validation_task_id)
      const validateInfo = extractValidateInfo(validationInfo)
      updatePayload = {
        ...updatePayload,
        status: validateInfo ? 'awaiting_verification' : 'validation_processing',
        validate_info: validateInfo || voice.validate_info,
        provider_payload: {
          ...(voice.provider_payload || {}),
          validationInfo,
        },
      }
    } else if (!voice.validation_task_id && ['failed', 'source_uploaded'].includes(voice.status) && voice.source_audio_path) {
      const voiceUrl = await createStudioVoiceAssetUrl(voice.source_audio_path, voice.source_audio_storage_provider)
      if (!voiceUrl) throw new Error('Não foi possível preparar o áudio para validação.')

      let validation: any = null
      try {
        validation = await createSunoVoiceValidation({
          voiceUrl,
          vocalStartS: Number(voice.vocal_start_s) || 0,
          vocalEndS: Math.max((Number(voice.vocal_start_s) || 0) + 1, Number(voice.vocal_end_s) || 20),
          language: voice.language || 'pt',
        })
      } catch (error: any) {
        updatePayload = {
          ...updatePayload,
          status: 'failed',
          error_message: translateStudioVoiceError(error.message) || VOICE_PROCESSING_ERROR_MESSAGE,
          provider_payload: {
            ...(voice.provider_payload || {}),
            validationRetryError: {
              message: error.message || VOICE_PROCESSING_ERROR_MESSAGE,
              at: new Date().toISOString(),
            },
          },
        }
      }

      if (validation) {
        updatePayload = {
          ...updatePayload,
          status: 'validation_processing',
          validation_task_id: validation?.data?.taskId || null,
          validate_info: null,
          error_message: null,
          provider_payload: {
            ...(voice.provider_payload || {}),
            validationRetry: validation,
          },
        }
      }
    } else if (
      voice.status === 'failed' &&
      (isStudioVoiceExpiredError(voice.error_message) || String(voice.error_message || '').toLowerCase().includes('expir'))
    ) {
      updatePayload = {
        ...updatePayload,
        status: 'failed',
        is_available: false,
        error_message: voice.error_message,
      }
    } else if (voice.voice_generation_task_id && ['voice_processing', 'failed'].includes(voice.status)) {
      const recordInfo = await getSunoVoiceRecordInfo(voice.voice_generation_task_id)
      const status = recordInfo?.data?.status
      const voiceId = extractVoiceId(recordInfo) || voice.voice_id
      const isFailure = status === 'fail' || status === 'processing_validate_fail'
      let isAvailable = false

      if (status === 'success' && voice.voice_generation_task_id) {
        const availability = await checkSunoVoiceAvailability(voice.voice_generation_task_id).catch(() => null)
        isAvailable = Boolean(availability?.data?.isAvailable)
      }

      updatePayload = {
        ...updatePayload,
        status: isFailure ? 'failed' : status === 'success' ? 'ready' : 'voice_processing',
        voice_id: voiceId,
        is_available: isAvailable,
        error_message: isFailure ? (translateStudioVoiceError(recordInfo?.data?.errorMessage) || 'Falha ao criar voz com IA.') : null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          recordInfo,
        },
      }
    }

    const { data: updatedVoice, error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update(updatePayload)
      .eq('id', voice.id)
      .select('*')
      .single()

    if (error) throw error
    if (voice.status !== 'ready' && updatedVoice.status === 'ready' && !updatedVoice.provider_payload?.reactivationFree) {
      await chargeStudioVoiceCreationOnce({
        composerId: composer.composerId,
        voiceProfileId: updatedVoice.id,
        voiceName: updatedVoice.display_name,
        taskId: updatedVoice.voice_generation_task_id,
      })
    }

    return NextResponse.json({ voice: await mapVoice(updatedVoice) })
  } catch (error: any) {
    console.error('[Studio Voice] Erro atualizar voz:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar voz' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const voice = await getVoice(params.id, composer.composerId)
    if (!voice) return NextResponse.json({ error: 'Voz não encontrada' }, { status: 404 })
    if (!voice.validation_task_id || !voice.validate_info) {
      return NextResponse.json({ error: 'A frase de verificação ainda não está pronta. Clique em atualizar status.' }, { status: 400 })
    }

    let file: FormDataEntryValue | null = null
    let uploaded: {
      path: string
      provider: string
      contentType: string
      sizeBytes: number
    } | null = null

    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json()
      uploaded = {
        path: String(body?.uploadedAsset?.path || ''),
        provider: String(body?.uploadedAsset?.provider || ''),
        contentType: String(body?.uploadedAsset?.contentType || ''),
        sizeBytes: Number(body?.uploadedAsset?.sizeBytes) || 0,
      }
      validateStudioVoiceUploadedAsset({
        composerId: composer.composerId,
        ...uploaded,
      })
    } else {
      const formData = await request.formData()
      file = formData.get('audio')
    }

    if (!uploaded && !(file instanceof File)) {
      return NextResponse.json({ error: 'Envie a gravação da frase de verificação.' }, { status: 400 })
    }

    if (!uploaded && file instanceof File) {
      uploaded = await uploadStudioVoiceAsset({
        composerId: composer.composerId,
        file,
        kind: 'verify',
      })
    }

    if (!uploaded) {
      return NextResponse.json({ error: 'Envie a gravação da frase de verificação.' }, { status: 400 })
    }
    const verifyUrl = await createStudioVoiceAssetUrl(uploaded.path, uploaded.provider)
    if (!verifyUrl) throw new Error('Não foi possível preparar o áudio de verificação.')

    const voiceGeneration = await createSunoCustomVoice({
      taskId: voice.validation_task_id,
      verifyUrl,
      voiceName: voice.display_name,
      singerSkillLevel: voice.singer_skill_level,
    })

    const { data: updatedVoice, error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: 'voice_processing',
        verify_audio_path: uploaded.path,
        verify_audio_storage_provider: uploaded.provider,
        verify_audio_content_type: uploaded.contentType,
        verify_audio_size_bytes: uploaded.sizeBytes,
        voice_generation_task_id: voiceGeneration?.data?.taskId || null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          voiceGeneration,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', voice.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ voice: await mapVoice(updatedVoice) })
  } catch (error: any) {
    console.error('[Studio Voice] Erro enviar verificação:', error)
    return NextResponse.json({ error: error.message || 'Erro ao enviar verificação da voz' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('composer_id', composer.composerId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Studio Voice] Erro remover voz:', error)
    return NextResponse.json({ error: error.message || 'Erro ao remover voz' }, { status: 500 })
  }
}
