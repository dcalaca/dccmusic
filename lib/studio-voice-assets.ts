import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'

const STUDIO_AUDIO_BUCKET = 'studio-assets'
export const MAX_VOICE_AUDIO_BYTES = 50 * 1024 * 1024
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET_NAME || 'dccmusic-studio-assets'
const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

let r2Client: S3Client | null = null

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

function monthKey() {
  const date = new Date()
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes('wav')) return 'wav'
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
  if (contentType.includes('ogg')) return 'ogg'
  if (contentType.includes('mp4')) return 'm4a'
  if (contentType.includes('webm')) return 'webm'
  return 'mp3'
}

function validateVoiceAudioMetadata(contentType: string, sizeBytes: number) {
  if (!contentType.startsWith('audio/')) {
    throw new Error('Envie um arquivo de áudio.')
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('Arquivo de áudio inválido.')
  }

  if (sizeBytes > MAX_VOICE_AUDIO_BYTES) {
    throw new Error('O áudio da voz precisa ter no máximo 50 MB.')
  }
}

export function createStudioVoiceAssetPath(input: {
  composerId: string
  contentType: string
  kind: 'source' | 'verify'
}) {
  const extension = extensionFromContentType(input.contentType)
  return `${input.composerId}/voices/${monthKey()}/${randomUUID()}-${input.kind}.${extension}`
}

export async function createStudioVoiceDirectUpload(input: {
  composerId: string
  contentType: string
  sizeBytes: number
  kind: 'source' | 'verify'
}) {
  validateVoiceAudioMetadata(input.contentType, input.sizeBytes)

  const r2 = getR2Client()
  if (!r2) {
    throw new Error('Upload direto de áudio não configurado no servidor.')
  }

  const path = createStudioVoiceAssetPath({
    composerId: input.composerId,
    contentType: input.contentType,
    kind: input.kind,
  })

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
    provider: 'r2',
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  }
}

export function validateStudioVoiceUploadedAsset(input: {
  composerId: string
  path: string
  provider: string
  contentType: string
  sizeBytes: number
}) {
  validateVoiceAudioMetadata(input.contentType, input.sizeBytes)

  if (input.provider !== 'r2') {
    throw new Error('Provedor de upload inválido.')
  }

  const expectedPrefix = `${input.composerId}/voices/`
  if (!input.path || !input.path.startsWith(expectedPrefix)) {
    throw new Error('Caminho do áudio inválido.')
  }
}

export async function uploadStudioVoiceAsset(input: {
  composerId: string
  file: File
  kind: 'source' | 'verify'
}) {
  const contentType = input.file.type || 'audio/mpeg'
  validateVoiceAudioMetadata(contentType, input.file.size)

  const arrayBuffer = await input.file.arrayBuffer()
  validateVoiceAudioMetadata(contentType, arrayBuffer.byteLength)

  const path = createStudioVoiceAssetPath({
    composerId: input.composerId,
    contentType,
    kind: input.kind,
  })
  const buffer = Buffer.from(arrayBuffer)
  const r2 = getR2Client()

  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }))

    return {
      path,
      provider: 'r2',
      contentType,
      sizeBytes: buffer.byteLength,
    }
  }

  const { error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error
  return {
    path,
    provider: 'supabase',
    contentType,
    sizeBytes: buffer.byteLength,
  }
}

export async function createStudioVoiceAssetUrl(path?: string | null, provider?: string | null) {
  if (!path) return null
  const storageProvider = provider || 'supabase'

  if (storageProvider === 'r2') {
    if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${path.replace(/^\/+/, '')}`
    const r2 = getR2Client()
    if (!r2) return null

    return getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: path,
      }),
      { expiresIn: 60 * 60 }
    )
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STUDIO_AUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) throw error
  return data?.signedUrl || null
}
