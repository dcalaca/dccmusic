import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { createStudioVoiceAssetUrl, uploadStudioVoiceAsset, validateStudioVoiceUploadedAsset } from '@/lib/studio-voice-assets'
import { createSunoVoiceValidation } from '@/lib/suno-voice'
import { translateStudioVoiceError, VOICE_PROCESSING_ERROR_MESSAGE } from '@/lib/studio-voice-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ACTIVE_VOICES = 5

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

async function archiveDuplicateActiveVoices(composerId: string, displayName: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_voice_profiles')
    .select('id, created_at')
    .eq('composer_id', composerId)
    .neq('status', 'archived')
    .ilike('display_name', displayName)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length <= 1) return data?.[0]?.id || null

  const [voiceToKeep, ...duplicates] = data
  const duplicateIds = duplicates.map((voice: any) => voice.id).filter(Boolean)

  if (duplicateIds.length > 0) {
    const { error: archiveError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .in('id', duplicateIds)
      .eq('composer_id', composerId)

    if (archiveError) throw archiveError
  }

  return voiceToKeep.id
}

async function getVoiceById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_voice_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('*')
      .eq('composer_id', composer.composerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (error) throw error
    const voices = await Promise.all((data || []).map(mapVoice))
    return NextResponse.json({ voices, limit: MAX_ACTIVE_VOICES })
  } catch (error: any) {
    console.error('[Studio Voice] Erro listar vozes:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar vozes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let insertedVoiceId: string | null = null

  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { count, error: countError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composer.composerId)
      .neq('status', 'archived')

    if (countError) throw countError
    if ((count || 0) >= MAX_ACTIVE_VOICES) {
      return NextResponse.json({ error: 'Você já tem 5 vozes cadastradas. Apague uma voz antes de enviar outra.' }, { status: 400 })
    }

    let file: FormDataEntryValue | null = null
    let uploaded: {
      path: string
      provider: string
      contentType: string
      sizeBytes: number
    } | null = null
    let displayName = ''
    let consent = false
    let vocalStartS = 0
    let vocalEndS = 20

    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json()
      displayName = String(body?.displayName || '').trim().slice(0, 60)
      consent = Boolean(body?.consent)
      vocalStartS = Math.max(0, Number(body?.vocalStartS) || 0)
      vocalEndS = Math.max(vocalStartS + 1, Number(body?.vocalEndS) || 20)
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
      displayName = String(formData.get('displayName') || '').trim().slice(0, 60)
      consent = String(formData.get('consent') || '') === 'true'
      vocalStartS = Math.max(0, Number(formData.get('vocalStartS')) || 0)
      vocalEndS = Math.max(vocalStartS + 1, Number(formData.get('vocalEndS')) || 20)
    }

    if (!displayName) {
      return NextResponse.json({ error: 'Dê um nome para essa voz.' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ error: 'Confirme que você tem autorização para usar essa voz.' }, { status: 400 })
    }
    if (!uploaded && !(file instanceof File)) {
      return NextResponse.json({ error: 'Envie o áudio base da voz.' }, { status: 400 })
    }

    if (!uploaded && file instanceof File) {
      uploaded = await uploadStudioVoiceAsset({
        composerId: composer.composerId,
        file,
        kind: 'source',
      })
    }

    if (!uploaded) {
      return NextResponse.json({ error: 'Envie o áudio base da voz.' }, { status: 400 })
    }

    const { data: existingVoice, error: existingVoiceError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .select('id, display_name, status')
      .eq('composer_id', composer.composerId)
      .neq('status', 'archived')
      .ilike('display_name', displayName)
      .maybeSingle()

    if (existingVoiceError) throw existingVoiceError
    if (existingVoice) {
      return NextResponse.json(
        {
          error: `Você já tem uma voz ativa chamada "${existingVoice.display_name}". Exclua a voz antiga ou use outro nome antes de enviar novamente.`,
        },
        { status: 409 }
      )
    }

    const { data: voice, error: insertError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .insert({
        composer_id: composer.composerId,
        display_name: displayName,
        status: 'source_uploaded',
        source_audio_path: uploaded.path,
        source_audio_storage_provider: uploaded.provider,
        source_audio_content_type: uploaded.contentType,
        source_audio_size_bytes: uploaded.sizeBytes,
        vocal_start_s: vocalStartS,
        vocal_end_s: vocalEndS,
        language: 'pt',
        provider_payload: { consentConfirmed: true },
      })
      .select('*')
      .single()

    if (insertError) throw insertError
    insertedVoiceId = voice.id

    const voiceUrl = await createStudioVoiceAssetUrl(uploaded.path, uploaded.provider)
    if (!voiceUrl) throw new Error('Não foi possível preparar o áudio para validação.')

    const validation = await createSunoVoiceValidation({
      voiceUrl,
      vocalStartS,
      vocalEndS,
      language: 'pt',
    })

    const { data: updatedVoice, error: updateError } = await supabaseAdmin
      .from('studio_voice_profiles')
      .update({
        status: 'validation_processing',
        validation_task_id: validation?.data?.taskId || null,
        provider_payload: {
          ...(voice.provider_payload || {}),
          validation,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', voice.id)
      .select('*')
      .single()

    if (updateError) throw updateError
    const activeVoiceId = await archiveDuplicateActiveVoices(composer.composerId, displayName)
    const activeVoice = activeVoiceId ? await getVoiceById(activeVoiceId) : updatedVoice

    return NextResponse.json({
      voice: await mapVoice(activeVoice || updatedVoice),
      deduped: Boolean(activeVoiceId && activeVoiceId !== updatedVoice.id),
    })
  } catch (error: any) {
    console.error('[Studio Voice] Erro criar voz:', error)
    if (insertedVoiceId) {
      try {
        await supabaseAdmin
          .from('studio_voice_profiles')
          .update({
            status: 'failed',
            error_message: translateStudioVoiceError(error.message) || VOICE_PROCESSING_ERROR_MESSAGE,
            updated_at: new Date().toISOString(),
          })
          .eq('id', insertedVoiceId)
      } catch {
        // Evita mascarar o erro principal retornado para a tela.
      }
    }
    return NextResponse.json({ error: error.message || 'Erro ao criar voz' }, { status: 500 })
  }
}
