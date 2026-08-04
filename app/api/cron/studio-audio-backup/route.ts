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

/** Reabre falhas com path fantasma (claim antigo reservava path antes do upload). */
async function reopenFailedBackups(limit: number) {
  const { data: failed, error } = await supabaseAdmin
    .from('studio_versions')
    .select('id')
    .eq('audio_backup_status', 'failed')
    .or('audio_url.not.is.null,stream_audio_url.not.is.null')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  if (!failed?.length) return 0

  const ids = failed.map((row) => row.id)
  const { error: updateError } = await supabaseAdmin
    .from('studio_versions')
    .update({
      audio_path: null,
      stream_audio_path: null,
      audio_storage_provider: null,
      stream_audio_storage_provider: null,
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
    const limit = Math.max(1, Math.min(10, Number(searchParams.get('limit')) || 5))

    const reopened = await reopenFailedBackups(limit)

    let versions = await claimBackupBatch(limit)

    // Fallback se a fila SQL não achar nada: pega pending direto.
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
