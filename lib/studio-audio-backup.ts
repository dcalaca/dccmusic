import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'

const STUDIO_AUDIO_BUCKET = 'studio-assets'
export const MAX_STUDIO_INPUT_AUDIO_BYTES = 80 * 1024 * 1024
const MAX_AUDIO_BYTES = MAX_STUDIO_INPUT_AUDIO_BYTES
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

function validateStudioInputAudioMetadata(contentType: string, sizeBytes: number) {
  if (!contentType.startsWith('audio/')) {
    throw new Error('Envie um arquivo de áudio.')
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('Arquivo de áudio inválido.')
  }
  if (sizeBytes > MAX_AUDIO_BYTES) {
    throw new Error('O áudio precisa ter no máximo 80 MB.')
  }
}

/** Upload direto ao R2 (evita limite ~4.5MB da Vercel no body da API). */
export async function createStudioInputDirectUpload(input: {
  composerId: string
  contentType: string
  sizeBytes: number
  kind?: 'enhance-source' | 'transcribe'
  fileName?: string | null
}) {
  validateStudioInputAudioMetadata(input.contentType, input.sizeBytes)

  const r2 = getR2Client()
  if (!r2) {
    throw new Error('Upload direto de áudio não configurado no servidor.')
  }

  const extension = extensionFromUploadedAudio(input.contentType, input.fileName)
  const kind = input.kind || 'audio'
  const path = `${input.composerId}/uploads/${studioMonthKey()}/${randomUUID()}-${kind}.${extension}`

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      ContentType: input.contentType,
    }),
    { expiresIn: 60 * 10 }
  )

  return {
    uploadUrl,
    path,
    provider: 'r2' as const,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  }
}

export function validateStudioInputUploadedAsset(input: {
  composerId: string
  path: string
  provider: string
  contentType: string
  sizeBytes: number
}) {
  validateStudioInputAudioMetadata(input.contentType, input.sizeBytes)

  if (input.provider !== 'r2') {
    throw new Error('Provedor de upload inválido.')
  }

  const expectedPrefix = `${input.composerId}/uploads/`
  if (!input.path || !input.path.startsWith(expectedPrefix)) {
    throw new Error('Caminho do áudio inválido.')
  }
}

export async function uploadStudioInputAudio(input: {
  composerId: string
  file: File
  kind?: 'enhance-source'
}) {
  const contentType = input.file.type || 'audio/mpeg'
  validateStudioInputAudioMetadata(contentType, input.file.size)

  const arrayBuffer = await input.file.arrayBuffer()
  validateStudioInputAudioMetadata(contentType, arrayBuffer.byteLength)

  const extension = extensionFromUploadedAudio(contentType, input.file.name)
  const path = `${input.composerId}/uploads/${studioMonthKey()}/${randomUUID()}-${input.kind || 'audio'}.${extension}`
  const buffer = Buffer.from(arrayBuffer)
  return uploadStudioAudioBuffer({
    composerId: input.composerId,
    path,
    buffer,
    contentType,
  })
}

export async function uploadStudioAudioBuffer(input: {
  composerId: string
  path?: string
  folder?: 'stems' | 'uploads' | 'exports' | 'audio'
  fileName?: string
  buffer: Buffer
  contentType?: string
}) {
  const contentType = input.contentType || 'audio/mpeg'
  if (input.buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error('Áudio maior que o limite interno.')
  }

  const path = input.path ||
    `${input.composerId}/${input.folder || 'uploads'}/${studioMonthKey()}/${input.fileName || `${randomUUID()}.mp3`}`
  const r2 = getR2Client()

  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: input.buffer,
      ContentType: contentType,
    }))

    return { path, provider: 'r2' as const, contentType, sizeBytes: input.buffer.byteLength }
  }

  const { error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .upload(path, input.buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error
  return { path, provider: 'supabase' as const, contentType, sizeBytes: input.buffer.byteLength }
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

function contentTypeFromAudioPath(path: string, fallback = 'audio/mpeg') {
  const lower = path.toLowerCase()
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  return fallback
}

/** Baixa áudio do storage interno (R2/Supabase) no servidor — evita CORS no browser. */
export async function downloadStudioAudioBuffer(path?: string | null, provider?: string | null) {
  if (!path) return null
  const storageProvider = provider || 'supabase'

  if (storageProvider === 'r2') {
    const r2 = getR2Client()
    if (!r2) throw new Error('R2 não configurado.')

    const result = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: path,
      })
    )
    if (!result.Body) throw new Error('Áudio vazio no R2.')
    const bytes = await result.Body.transformToByteArray()
    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType || contentTypeFromAudioPath(path),
    }
  }

  const { data, error } = await supabaseAdmin.storage.from(STUDIO_AUDIO_BUCKET).download(path)
  if (error || !data) {
    throw new Error(error?.message || 'Falha ao baixar áudio do Supabase.')
  }
  const arrayBuffer = await data.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || contentTypeFromAudioPath(path),
  }
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

function isStreamBackupPath(path?: string | null) {
  return Boolean(path && String(path).includes('-stream.'))
}

export async function getStudioVersionAudioUrls(version: any) {
  const [audioSignedUrl, streamSignedUrl] = await Promise.all([
    createStudioAudioSignedUrl(version?.audio_path, version?.audio_storage_provider),
    createStudioAudioSignedUrl(version?.stream_audio_path, version?.stream_audio_storage_provider || version?.audio_storage_provider),
  ])

  const providerFullUrl = version?.audio_url || null
  const providerStreamUrl = version?.stream_audio_url || null
  const providerHasDistinctFull = Boolean(
    providerFullUrl && providerStreamUrl && providerFullUrl !== providerStreamUrl
  )
  const internalAudioIsStreamOnly = isStreamBackupPath(version?.audio_path)
  // Backup antigo pode ter gravado stream com nome "-audio"; enquanto houver URL completa
  // do provedor, preferimos ela para não cortar o final.
  const preferProviderFull = internalAudioIsStreamOnly || providerHasDistinctFull

  const fullAudioUrl = preferProviderFull
    ? (providerFullUrl || audioSignedUrl || null)
    : (audioSignedUrl || providerFullUrl || null)

  return {
    audioUrl: fullAudioUrl || streamSignedUrl || providerStreamUrl || null,
    streamAudioUrl: streamSignedUrl || fullAudioUrl || providerStreamUrl || providerFullUrl || null,
  }
}

/** Rebaixa stream salvo como áudio final quando o MP3 completo já existir na versão. */
export async function repairStudioVersionFullAudioBackup(version: any) {
  if (!version?.id || !version?.composer_id) return { repaired: false, reason: 'missing_version' }
  const fullAudioUrl = version.audio_url || null
  const streamAudioUrl = version.stream_audio_url || null
  if (!fullAudioUrl) return { repaired: false, reason: 'missing_full_url' }
  if (streamAudioUrl && fullAudioUrl === streamAudioUrl) {
    return { repaired: false, reason: 'no_distinct_full_url' }
  }

  return backupStudioVersionAudio({
    versionId: version.id,
    composerId: version.composer_id,
    audioUrl: fullAudioUrl,
    streamAudioUrl,
    forceFullAudioUpgrade: true,
  })
}

export async function backupStudioVersionAudio(input: {
  versionId?: string | null
  composerId?: string | null
  audioUrl?: string | null
  streamAudioUrl?: string | null
  forceFullAudioUpgrade?: boolean
}) {
  if (!input.versionId || !input.composerId) return { backedUp: false, reason: 'missing_version' }
  const fullAudioUrl = input.audioUrl || null
  const streamAudioUrl = input.streamAudioUrl || null
  if (!fullAudioUrl && !streamAudioUrl) return { backedUp: false, reason: 'missing_audio_url' }

  try {
    const { data: version, error: versionError } = await supabaseAdmin
      .from('studio_versions')
      .select('id, audio_path, stream_audio_path, audio_backup_status, audio_storage_provider, stream_audio_storage_provider')
      .eq('id', input.versionId)
      .maybeSingle()

    if (versionError) throw versionError

    // Nunca gravar o stream parcial como áudio final.
    // No callback "first" só existe stream; no "complete" chega o MP3 completo.
    const audioPathIsStreamOnly = isStreamBackupPath(version?.audio_path)
    const needsFullAudioBackup = Boolean(
      fullAudioUrl && (
        input.forceFullAudioUpgrade ||
        !version?.audio_path ||
        audioPathIsStreamOnly ||
        (isR2Configured() && version?.audio_storage_provider !== 'r2')
      )
    )

    const needsStreamBackup = Boolean(
      streamAudioUrl &&
      streamAudioUrl !== fullAudioUrl &&
      !version?.stream_audio_path
    )

    const hasUsableFullAudio = Boolean(
      version?.audio_path &&
      !audioPathIsStreamOnly &&
      (!isR2Configured() || version?.audio_storage_provider === 'r2')
    )

    if (!needsFullAudioBackup && !needsStreamBackup && (hasUsableFullAudio || (!fullAudioUrl && version?.stream_audio_path))) {
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

    let audioBackup: { path: string; provider: string } | null = hasUsableFullAudio && !needsFullAudioBackup
      ? { path: version!.audio_path, provider: version!.audio_storage_provider || 'supabase' }
      : null

    if (needsFullAudioBackup && fullAudioUrl) {
      audioBackup = await uploadAudio({
        composerId: input.composerId,
        versionId: input.versionId,
        sourceUrl: fullAudioUrl,
        kind: 'audio',
      })
    }

    let streamAudioBackup: { path: string; provider: string } | null = version?.stream_audio_path
      ? {
          path: version.stream_audio_path,
          provider: version.stream_audio_storage_provider || version.audio_storage_provider || 'supabase',
        }
      : null

    if (!fullAudioUrl && streamAudioUrl && !streamAudioBackup) {
      // Só stream disponível: guarda só como stream, sem promover a áudio final.
      streamAudioBackup = await uploadAudio({
        composerId: input.composerId,
        versionId: input.versionId,
        sourceUrl: streamAudioUrl,
        kind: 'stream',
      })
    } else if (needsStreamBackup && streamAudioUrl) {
      streamAudioBackup = await uploadAudio({
        composerId: input.composerId,
        versionId: input.versionId,
        sourceUrl: streamAudioUrl,
        kind: 'stream',
      })
    } else if (!streamAudioBackup && audioBackup) {
      streamAudioBackup = audioBackup
    }

    if (!audioBackup && !streamAudioBackup) {
      return { backedUp: false, reason: 'nothing_to_backup' }
    }

    const { data: updatedVersion, error: updateError } = await supabaseAdmin
      .from('studio_versions')
      .update({
        audio_path: audioBackup?.path || version?.audio_path || null,
        stream_audio_path: streamAudioBackup?.path || version?.stream_audio_path || audioBackup?.path || null,
        audio_storage_provider: audioBackup?.provider || version?.audio_storage_provider || null,
        stream_audio_storage_provider:
          streamAudioBackup?.provider || version?.stream_audio_storage_provider || audioBackup?.provider || null,
        audio_backup_status: audioBackup || streamAudioBackup ? 'backed_up' : version?.audio_backup_status || null,
        audio_backup_error: null,
        audio_backed_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.versionId)
      .select('id, audio_path, stream_audio_path, audio_storage_provider, stream_audio_storage_provider')
      .maybeSingle()

    if (updateError) throw updateError
    if (audioBackup && (!updatedVersion?.audio_path || updatedVersion.audio_storage_provider !== audioBackup.provider)) {
      throw new Error('Backup enviado, mas o Supabase não confirmou a gravação do caminho interno.')
    }

    return {
      backedUp: true,
      provider: audioBackup?.provider || streamAudioBackup?.provider,
      audioPath: audioBackup?.path || null,
      streamAudioPath: streamAudioBackup?.path || null,
    }
  } catch (error: any) {
    if (isBackupSchemaMissing(error)) return { backedUp: false, reason: 'setup_required' }

    console.error('[Studio Audio Backup] Erro ao salvar backup interno:', error)
    try {
      await supabaseAdmin
        .from('studio_versions')
        .update({
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
