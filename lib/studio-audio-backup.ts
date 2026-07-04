import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'

const STUDIO_AUDIO_BUCKET = 'studio-assets'
const MAX_AUDIO_BYTES = 80 * 1024 * 1024
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET_NAME || 'dccmusic-studio-assets'
const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

let r2Client: S3Client | null = null

function studioMonthKey() {
  const date = new Date()
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function isBackupSchemaMissing(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('audio_path') ||
    message.includes('stream_audio_path') ||
    message.includes('audio_storage_provider') ||
    message.includes('stream_audio_storage_provider') ||
    message.includes('audio_backup_status') ||
    message.includes('schema cache')
  )
}

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey || !R2_BUCKET) return null
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  return r2Client
}

function isR2Configured() {
  return Boolean(getR2Client())
}

function extensionFromContentType(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes('mpeg')) return 'mp3'
  if (contentType?.includes('wav')) return 'wav'
  if (contentType?.includes('ogg')) return 'ogg'
  if (contentType?.includes('mp4')) return 'm4a'

  try {
    const pathname = new URL(sourceUrl).pathname
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/)
    if (match?.[1]) return match[1].toLowerCase()
  } catch {
    return 'mp3'
  }

  return 'mp3'
}

function extensionFromUploadedAudio(contentType: string, fileName?: string | null) {
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
  if (contentType.includes('wav')) return 'wav'
  if (contentType.includes('ogg')) return 'ogg'
  if (contentType.includes('mp4')) return 'm4a'
  if (contentType.includes('webm')) return 'webm'
  const match = String(fileName || '').match(/\.([a-zA-Z0-9]{2,5})$/)
  return match?.[1]?.toLowerCase() || 'mp3'
}

export async function uploadStudioInputAudio(input: {
  composerId: string
  file: File
  kind?: 'enhance-source'
}) {
  const contentType = input.file.type || 'audio/mpeg'
  if (!contentType.startsWith('audio/')) {
    throw new Error('Envie um arquivo de áudio.')
  }
  if (input.file.size > MAX_AUDIO_BYTES) {
    throw new Error('O áudio precisa ter no máximo 80 MB.')
  }

  const arrayBuffer = await input.file.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error('O áudio precisa ter no máximo 80 MB.')
  }

  const extension = extensionFromUploadedAudio(contentType, input.file.name)
  const path = `${input.composerId}/uploads/${studioMonthKey()}/${randomUUID()}-${input.kind || 'audio'}.${extension}`
  const buffer = Buffer.from(arrayBuffer)
  const r2 = getR2Client()

  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }))

    return { path, provider: 'r2', contentType, sizeBytes: buffer.byteLength }
  }

  const { error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error
  return { path, provider: 'supabase', contentType, sizeBytes: buffer.byteLength }
}

async function downloadAudio(sourceUrl: string) {
  const response = await fetch(sourceUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Falha ao baixar áudio externo (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  const contentLength = Number(response.headers.get('content-length')) || 0
  if (contentLength > MAX_AUDIO_BYTES) {
    throw new Error('Áudio maior que o limite de backup interno.')
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error('Áudio maior que o limite de backup interno.')
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  }
}

async function uploadAudio(input: {
  composerId: string
  versionId: string
  sourceUrl: string
  kind: 'audio' | 'stream'
}) {
  const downloaded = await downloadAudio(input.sourceUrl)
  const extension = extensionFromContentType(downloaded.contentType, input.sourceUrl)
  const path = `${input.composerId}/audio/${studioMonthKey()}/${input.versionId}-${input.kind}.${extension}`
  const r2 = getR2Client()

  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: downloaded.buffer,
      ContentType: downloaded.contentType,
    }))

    return { path, provider: 'r2' }
  }

  const { error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .upload(path, downloaded.buffer, {
      contentType: downloaded.contentType,
      upsert: true,
    })

  if (error) throw error
  return { path, provider: 'supabase' }
}

export async function createStudioAudioSignedUrl(path?: string | null, provider?: string | null) {
  if (!path) return null
  const storageProvider = provider || 'supabase'

  if (storageProvider === 'r2') {
    if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${path.replace(/^\/+/, '')}`

    const r2 = getR2Client()
    if (!r2) return null

    try {
      return await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: path,
        }),
        { expiresIn: 60 * 60 }
      )
    } catch (error) {
      console.error('[Studio Audio Backup] Erro ao assinar áudio R2:', error)
      return null
    }
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) {
    console.error('[Studio Audio Backup] Erro ao assinar áudio interno:', error)
    return null
  }

  return data?.signedUrl || null
}

export async function getStudioVersionAudioUrls(version: any) {
  const [audioSignedUrl, streamSignedUrl] = await Promise.all([
    createStudioAudioSignedUrl(version?.audio_path, version?.audio_storage_provider),
    createStudioAudioSignedUrl(version?.stream_audio_path, version?.stream_audio_storage_provider || version?.audio_storage_provider),
  ])

  return {
    audioUrl: audioSignedUrl || version?.audio_url || null,
    streamAudioUrl: streamSignedUrl || audioSignedUrl || version?.stream_audio_url || version?.audio_url || null,
  }
}

export async function backupStudioVersionAudio(input: {
  versionId?: string | null
  composerId?: string | null
  audioUrl?: string | null
  streamAudioUrl?: string | null
}) {
  if (!input.versionId || !input.composerId) return { backedUp: false, reason: 'missing_version' }
  const sourceAudioUrl = input.audioUrl || input.streamAudioUrl
  if (!sourceAudioUrl) return { backedUp: false, reason: 'missing_audio_url' }

  try {
    const { data: version, error: versionError } = await supabaseAdmin
      .from('studio_versions')
      .select('id, audio_path, stream_audio_path, audio_backup_status, audio_storage_provider, stream_audio_storage_provider')
      .eq('id', input.versionId)
      .maybeSingle()

    if (versionError) throw versionError
    const streamUsesSameSource = !input.streamAudioUrl || input.streamAudioUrl === sourceAudioUrl
    const streamBackedUpOnTarget = streamUsesSameSource
      || (version?.stream_audio_path && (version?.stream_audio_storage_provider || version?.audio_storage_provider) === 'r2')
    const alreadyBackedUpOnTarget = isR2Configured()
      ? version?.audio_path && version?.audio_storage_provider === 'r2' && streamBackedUpOnTarget
      : version?.audio_path && (streamUsesSameSource || version?.stream_audio_path)
    if (alreadyBackedUpOnTarget) {
      if (version?.audio_backup_status !== 'backed_up') {
        await supabaseAdmin
          .from('studio_versions')
          .update({
            audio_backup_status: 'backed_up',
            audio_backup_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.versionId)
      }

      return { backedUp: true, reason: 'already_backed_up' }
    }

    const audioAlreadyOnR2 = isR2Configured() && version?.audio_path && version?.audio_storage_provider === 'r2'
    const audioBackup = audioAlreadyOnR2
      ? { path: version.audio_path, provider: 'r2' }
      : await uploadAudio({
          composerId: input.composerId,
          versionId: input.versionId,
          sourceUrl: sourceAudioUrl,
          kind: 'audio',
        })

    let streamAudioBackup = audioBackup
    const distinctStreamUrl = input.streamAudioUrl && input.streamAudioUrl !== sourceAudioUrl
      ? input.streamAudioUrl
      : null
    if (distinctStreamUrl) {
      const streamAlreadyOnR2 = isR2Configured()
        && version?.stream_audio_path
        && (version?.stream_audio_storage_provider || version?.audio_storage_provider) === 'r2'
      streamAudioBackup = streamAlreadyOnR2
        ? { path: version.stream_audio_path, provider: 'r2' }
        : await uploadAudio({
            composerId: input.composerId,
            versionId: input.versionId,
            sourceUrl: distinctStreamUrl,
            kind: 'stream',
          })
    }

    const { data: updatedVersion, error: updateError } = await supabaseAdmin
      .from('studio_versions')
      .update({
        audio_path: audioBackup.path,
        stream_audio_path: streamAudioBackup.path,
        audio_storage_provider: audioBackup.provider,
        stream_audio_storage_provider: streamAudioBackup.provider,
        audio_backup_status: 'backed_up',
        audio_backup_error: null,
        audio_backed_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.versionId)
      .select('id, audio_path, stream_audio_path, audio_storage_provider, stream_audio_storage_provider')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedVersion?.audio_path || updatedVersion.audio_storage_provider !== audioBackup.provider) {
      throw new Error('Backup enviado, mas o Supabase não confirmou a gravação do caminho interno.')
    }

    return {
      backedUp: true,
      provider: audioBackup.provider,
      audioPath: audioBackup.path,
      streamAudioPath: streamAudioBackup.path,
    }
  } catch (error: any) {
    if (isBackupSchemaMissing(error)) return { backedUp: false, reason: 'setup_required' }

    console.error('[Studio Audio Backup] Erro ao salvar backup interno:', error)
    try {
      await supabaseAdmin
        .from('studio_versions')
        .update({
          audio_path: null,
          stream_audio_path: null,
          audio_backup_status: 'failed',
          audio_backup_error: String(error?.message || error).slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.versionId)
    } catch {
      // Não bloqueia a geração se falhar só o registro do erro do backup.
    }

    return { backedUp: false, reason: 'error', error: error?.message || String(error) }
  }
}
