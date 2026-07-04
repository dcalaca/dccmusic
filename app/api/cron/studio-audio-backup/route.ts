import { NextRequest, NextResponse } from 'next/server'
import { backupStudioVersionAudio } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(3, Number(searchParams.get('limit')) || 3))
    const now = new Date().toISOString()

    const cleanupUpdate = {
      audio_backup_status: 'backed_up',
      audio_backup_error: null,
      updated_at: now,
    }

    const [cleanupStatus, cleanupNullStatus] = await Promise.all([
      supabaseAdmin
        .from('studio_versions')
        .update(cleanupUpdate)
        .eq('audio_storage_provider', 'r2')
        .neq('audio_backup_status', 'backed_up'),
      supabaseAdmin
        .from('studio_versions')
        .update(cleanupUpdate)
        .eq('audio_storage_provider', 'r2')
        .is('audio_backup_status', null),
    ])

    if (cleanupStatus.error) throw cleanupStatus.error
    if (cleanupNullStatus.error) throw cleanupNullStatus.error

    const { data: candidates, error } = await supabaseAdmin
      .rpc('claim_studio_audio_backup_batch_v3', { batch_limit: limit })

    if (error) throw error

    const versions = (candidates || []).filter((version: any) => {
      const sourceAudioUrl = version.audio_url || version.stream_audio_url
      const streamUsesSameSource = !version.stream_audio_url || version.stream_audio_url === sourceAudioUrl
      const audioBackedUpOnR2 = Boolean(version.audio_path) && version.audio_storage_provider === 'r2'
      const streamBackedUpOnR2 = streamUsesSameSource
        || (Boolean(version.stream_audio_path) && (version.stream_audio_storage_provider || version.audio_storage_provider) === 'r2')

      return !audioBackedUpOnR2 || !streamBackedUpOnR2
    }).slice(0, limit)

    const results = []
    for (const version of versions || []) {
      const result = await backupStudioVersionAudio({
        versionId: version.id,
        composerId: version.composer_id,
        audioUrl: version.audio_url,
        streamAudioUrl: version.stream_audio_url,
      })

      results.push({
        versionId: version.id,
        ...result,
      })
    }

    return NextResponse.json({
      success: true,
      queueFunction: 'claim_studio_audio_backup_batch_v3',
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
