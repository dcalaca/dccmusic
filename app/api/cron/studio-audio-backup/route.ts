import { NextRequest, NextResponse } from 'next/server'
import { backupStudioVersionAudio } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function isBackupSchemaMissing(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('audio_path') ||
    message.includes('audio_backup_status') ||
    message.includes('schema cache')
  )
}

function isTransientBackupError(value: unknown) {
  const message = String(value || '').toLowerCase()
  return (
    message.includes('terminated') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('abort') ||
    message.includes('fetch failed') ||
    message.includes('econn') ||
    message.includes('network') ||
    /áudio externo \(5\d\d\)/.test(message) ||
    /audio externo \(5\d\d\)/.test(message)
  )
}

/** Reabre apenas falhas transitórias. HTTP 4xx/links expirados não entram em loop eterno. */
async function reopenFailedBackups(limit: number) {
  const { data: failed, error } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_backup_error, updated_at')
    .eq('audio_backup_status', 'failed')
    .or('audio_url.not.is.null,stream_audio_url.not.is.null')
    .order('updated_at', { ascending: true })
    .limit(Math.max(limit * 4, 8))

  if (error) throw error

  const ids = (failed || [])
    .filter((row: any) => isTransientBackupError(row.audio_backup_error))
    .slice(0, limit)
    .map((row: any) => row.id)

  if (!ids.length) return 0

  const { error: updateError } = await supabaseAdmin
    .from('studio_versions')
    .update({
      audio_backup_status: 'pending',
      audio_backup_error: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('audio_backup_status', 'failed')

  if (updateError) throw updateError
  return ids.length
}

async function claimBackupBatch(limit: number) {
  const { data, error } = await supabaseAdmin.rpc('claim_studio_audio_backup_batch_v3', {
    batch_limit: limit,
  })
  if (error) throw error
  return data || []
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // Downloads de áudio são pesados. Lotes pequenos evitam estourar os 60s da função.
    const limit = Math.max(1, Math.min(3, Number(searchParams.get('limit')) || 2))

    const reopened = await reopenFailedBackups(limit)
    let versions = await claimBackupBatch(limit)

    // Fallback se a função SQL não achar nada: pega apenas pending.
    if (!versions.length) {
      const { data: pending, error } = await supabaseAdmin
        .from('studio_versions')
        .select('id, composer_id, audio_url, stream_audio_url, audio_path, stream_audio_path, audio_storage_provider, stream_audio_storage_provider, audio_backup_status, created_at')
        .eq('audio_backup_status', 'pending')
        .or('audio_url.not.is.null,stream_audio_url.not.is.null')
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      versions = pending || []
    }

    const results = []
    for (const version of versions || []) {
      const result = await backupStudioVersionAudio({
        versionId: version.id,
        composerId: version.composer_id,
        audioUrl: version.audio_url,
        streamAudioUrl: version.stream_audio_url,
        forceFullAudioUpgrade: true,
      })

      results.push({
        versionId: version.id,
        ...result,
      })
    }

    return NextResponse.json({
      success: true,
      queueFunction: 'claim_studio_audio_backup_batch_v3',
      reopenedFailed: reopened,
      checked: versions?.length || 0,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    if (isBackupSchemaMissing(error)) {
      return NextResponse.json({
        success: false,
        setupRequired: true,
        error: 'Execute primeiro o SQL-BACKUP-AUDIO-STUDIO.sql no Supabase.',
      }, { status: 500 })
    }

    console.error('[CRON STUDIO AUDIO BACKUP] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer backup dos áudios do Studio IA' },
      { status: 500 }
    )
  }
}