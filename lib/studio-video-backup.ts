import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase'

const STUDIO_ASSET_BUCKET = 'studio-assets'
const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET_NAME || 'dccmusic-studio-assets'
const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

let r2Client: S3Client | null = null

type StudioVideoBackupResult = {
  backedUp: boolean
  videoRequest: any | null
  error?: string
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
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return r2Client
}

function studioMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function isTransientVideoBackupError(error: unknown) {
  const message = String((error as any)?.message || error || '').toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('econn') ||
    message.includes('network') ||
    /vídeo externo \(5\d\d\)/.test(message)
  )
}

async function downloadVideo(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'video/mp4,video/*;q=0.9,application/octet-stream;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; DCCMusicVideoBackup/1.0)',
    },
  })
  if (!response.ok) throw new Error(`Falha ao baixar vídeo externo (${response.status})`)

  const contentLength = Number(response.headers.get('content-length')) || 0
  if (contentLength > MAX_VIDEO_BYTES) throw new Error('Vídeo maior que o limite de backup permanente.')

  const arrayBuffer = await response.arrayBuffer()
  if (!arrayBuffer.byteLength) throw new Error('Falha ao baixar vídeo externo (arquivo vazio)')
  if (arrayBuffer.byteLength > MAX_VIDEO_BYTES) throw new Error('Vídeo maior que o limite de backup permanente.')

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || 'video/mp4',
  }
}

export async function createStudioVideoUrl(path?: string | null, provider?: string | null) {
  if (!path) return null
  const storageProvider = provider || 'supabase'

  if (storageProvider === 'r2') {
    if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${path.replace(/^\/+/, '')}`
    const r2 = getR2Client()
    if (!r2) return null
    return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }), { expiresIn: 60 * 60 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STUDIO_ASSET_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) return null
  return data?.signedUrl || null
}

export async function resolveStudioVideoUrl(videoRequest: any) {
  if (videoRequest?.video_path && videoRequest?.video_backup_status === 'backed_up') {
    const permanentUrl = await createStudioVideoUrl(
      videoRequest.video_path,
      videoRequest.video_storage_provider
    )
    if (permanentUrl) return permanentUrl
  }
  return String(videoRequest?.video_url || '').trim() || null
}

export async function saveInternalStudioVideo(input: {
  videoRequest: any
  buffer: Buffer
  contentType?: string
}) {
  const { videoRequest, buffer } = input
  if (!videoRequest?.id || !videoRequest?.composer_id || !videoRequest?.project_id) {
    throw new Error('Solicitação de vídeo incompleta.')
  }
  if (!buffer.byteLength) throw new Error('O vídeo gerado está vazio.')
  if (buffer.byteLength > MAX_VIDEO_BYTES) throw new Error('Vídeo maior que o limite interno.')

  const path = `${videoRequest.composer_id}/video/${studioMonthKey()}/${videoRequest.id}.mp4`
  const contentType = input.contentType || 'video/mp4'
  const r2 = getR2Client()
  let provider = 'supabase'

  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }))
    provider = 'r2'
  } else {
    const { error } = await supabaseAdmin.storage
      .from(STUDIO_ASSET_BUCKET)
      .upload(path, buffer, { contentType, upsert: true })
    if (error) throw error
  }

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'completed',
      video_url: null,
      video_path: path,
      video_storage_provider: provider,
      video_backup_status: 'backed_up',
      video_backup_error: null,
      video_backed_up_at: now,
      completed_at: now,
      error_message: null,
      response_payload: {
        provider: 'dcc-internal',
        format: 'static-cover-lyrics-v5',
        bytes: buffer.byteLength,
      },
      updated_at: now,
    })
    .eq('id', videoRequest.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function backupStudioVideoRequest(videoRequest: any): Promise<StudioVideoBackupResult> {
  if (!videoRequest?.id || !videoRequest?.composer_id || !videoRequest?.project_id) {
    return { backedUp: false, videoRequest: null, error: 'Solicitação de vídeo incompleta.' }
  }
  if (videoRequest.video_path && videoRequest.video_backup_status === 'backed_up') {
    return { backedUp: true, videoRequest }
  }

  const sourceUrl = String(videoRequest.video_url || '').trim()
  if (!sourceUrl) return { backedUp: false, videoRequest: null, error: 'URL do vídeo não informada.' }

  await supabaseAdmin
    .from('studio_video_requests')
    .update({
      video_backup_status: 'processing',
      video_backup_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)

  try {
    const downloaded = await downloadVideo(sourceUrl)
    const path = `${videoRequest.composer_id}/video/${studioMonthKey()}/${videoRequest.id}.mp4`
    const r2 = getR2Client()
    let provider = 'supabase'

    if (r2) {
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: path,
        Body: downloaded.buffer,
        ContentType: downloaded.contentType,
      }))
      provider = 'r2'
    } else {
      const { error } = await supabaseAdmin.storage
        .from(STUDIO_ASSET_BUCKET)
        .upload(path, downloaded.buffer, {
          contentType: downloaded.contentType,
          upsert: true,
        })
      if (error) throw error
    }

    const { data, error } = await supabaseAdmin
      .from('studio_video_requests')
      .update({
        video_path: path,
        video_storage_provider: provider,
        video_backup_status: 'backed_up',
        video_backup_error: null,
        video_backed_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
      .select('*')
      .single()
    if (error) throw error
    return { backedUp: true, videoRequest: data }
  } catch (error: any) {
    const message = error?.message || 'Falha ao salvar vídeo permanentemente.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        video_backup_status: isTransientVideoBackupError(error) ? 'pending' : 'failed',
        video_backup_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    return { backedUp: false, videoRequest: null, error: message }
  }
}
