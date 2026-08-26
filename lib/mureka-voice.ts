import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { supabaseAdmin } from './supabase'
import { createStudioVoiceAssetUrl } from './studio-voice-assets'

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as { path: string }
const MUREKA_VOICE_MAX_BYTES = 10 * 1024 * 1024
const execFileAsync = promisify(execFile)

function getMurekaApiKey() {
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey) throw new Error('Mureka não configurado no servidor.')
  return apiKey
}

function getStoredMurekaVocalId(voice: any) {
  return voice?.provider_payload?.mureka?.vocalId ||
    voice?.provider_payload?.mureka?.vocal_id ||
    voice?.provider_payload?.murekaVocalId ||
    null
}

function extractMurekaVocalId(payload: any) {
  return payload?.data?.vocal_id ||
    payload?.data?.vocalId ||
    payload?.data?.id ||
    payload?.vocal_id ||
    payload?.vocalId ||
    payload?.id ||
    null
}

function isMurekaCompatibleAudio(contentType: string) {
  const normalized = String(contentType || '').toLowerCase()
  return normalized.includes('mpeg') ||
    normalized.includes('mp3') ||
    normalized.includes('mp4') ||
    normalized.includes('m4a')
}

function extensionFromContentType(contentType: string) {
  const normalized = String(contentType || '').toLowerCase()
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a'
  return 'mp3'
}

function mimeTypeForMureka(contentType: string) {
  const normalized = String(contentType || '').toLowerCase()
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'audio/mp4'
  return 'audio/mpeg'
}

function voiceAsset(voice: any, kind: 'verify' | 'source') {
  if (kind === 'verify') {
    return {
      path: voice.verify_audio_path,
      provider: voice.verify_audio_storage_provider,
      contentType: voice.verify_audio_content_type || 'audio/mpeg',
      sizeBytes: Number(voice.verify_audio_size_bytes) || 0,
      kind,
    }
  }

  return {
    path: voice.source_audio_path,
    provider: voice.source_audio_storage_provider,
    contentType: voice.source_audio_content_type || 'audio/mpeg',
    sizeBytes: Number(voice.source_audio_size_bytes) || 0,
    kind,
  }
}

function pickVoiceAsset(voice: any) {
  const verify = voiceAsset(voice, 'verify')
  const source = voiceAsset(voice, 'source')

  if (verify.path && isMurekaCompatibleAudio(verify.contentType)) return verify
  if (source.path && isMurekaCompatibleAudio(source.contentType)) return source
  if (verify.path) return verify
  return source
}

async function convertToMurekaMp3(buffer: Buffer) {
  const id = randomUUID()
  const inputPath = join(tmpdir(), `dcc-mureka-voice-${id}.input`)
  const outputPath = join(tmpdir(), `dcc-mureka-voice-${id}.mp3`)

  try {
    await writeFile(inputPath, buffer)
    await execFileAsync(
      ffmpegInstaller.path,
      [
        '-y',
        '-i', inputPath,
        '-vn',
        '-ac', '1',
        '-ar', '44100',
        '-b:a', '128k',
        '-t', '30',
        outputPath,
      ],
      { timeout: 25_000, maxBuffer: 1024 * 1024 }
    )
    return await readFile(outputPath)
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)])
  }
}

async function prepareMurekaAudio(arrayBuffer: ArrayBuffer, contentType: string) {
  const original = Buffer.from(arrayBuffer)
  if (isMurekaCompatibleAudio(contentType)) {
    return {
      buffer: original,
      contentType: mimeTypeForMureka(contentType),
      extension: extensionFromContentType(contentType),
      converted: false,
    }
  }

  const converted = await convertToMurekaMp3(original)
  return {
    buffer: converted,
    contentType: 'audio/mpeg',
    extension: 'mp3',
    converted: true,
  }
}

export async function ensureMurekaVocalClone(voice: any) {
  const existingVocalId = getStoredMurekaVocalId(voice)
  if (existingVocalId) {
    return {
      vocalId: existingVocalId,
      reused: true,
      payload: voice.provider_payload?.mureka?.clone || null,
    }
  }

  const asset = pickVoiceAsset(voice)
  if (!asset.path) {
    throw new Error('Áudio da voz não encontrado para preparar fallback no Mureka.')
  }
  if (asset.sizeBytes > MUREKA_VOICE_MAX_BYTES) {
    throw new Error('Áudio da voz maior que 10 MB; o Mureka não aceita essa amostra para clonagem.')
  }

  const voiceUrl = await createStudioVoiceAssetUrl(asset.path, asset.provider)
  if (!voiceUrl) throw new Error('Não foi possível preparar o áudio da voz para o Mureka.')

  const audioResponse = await fetch(voiceUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!audioResponse.ok) {
    throw new Error('Não foi possível baixar o áudio da voz para enviar ao Mureka.')
  }

  const contentType = audioResponse.headers.get('content-type') || asset.contentType || 'audio/mpeg'
  const arrayBuffer = await audioResponse.arrayBuffer()
  if (arrayBuffer.byteLength > MUREKA_VOICE_MAX_BYTES) {
    throw new Error('Áudio da voz maior que 10 MB; o Mureka não aceita essa amostra para clonagem.')
  }

  const prepared = await prepareMurekaAudio(arrayBuffer, contentType)
  if (prepared.buffer.byteLength > MUREKA_VOICE_MAX_BYTES) {
    throw new Error('Áudio convertido da voz maior que 10 MB; não foi possível preparar a clonagem.')
  }

  const blobBytes = prepared.buffer.buffer.slice(
    prepared.buffer.byteOffset,
    prepared.buffer.byteOffset + prepared.buffer.byteLength
  ) as ArrayBuffer

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([blobBytes], { type: prepared.contentType }),
    `dcc-voice-${voice.id}.${prepared.extension}`
  )
  formData.append('description', String(voice.display_name || 'Voz DCC Music').slice(0, 1024))

  const response = await fetch('https://api.mureka.ai/v1/song/vocal-clone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getMurekaApiKey()}`,
    },
    body: formData,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => null)
  const vocalId = extractMurekaVocalId(payload)

  if (!response.ok || !vocalId) {
    throw new Error(payload?.error?.message || payload?.message || 'Não foi possível criar a voz no Mureka.')
  }

  const murekaPayload = {
    vocalId,
    clone: payload,
    clonedAt: new Date().toISOString(),
    sourceAssetKind: asset.kind,
    sourceConvertedToMp3: prepared.converted,
  }

  const { error: updateError } = await supabaseAdmin
    .from('studio_voice_profiles')
    .update({
      provider_payload: {
        ...(voice.provider_payload || {}),
        mureka: murekaPayload,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', voice.id)

  if (updateError) {
    throw new Error(`Voz criada no Mureka, mas não foi possível salvar o vocal_id: ${updateError.message}`)
  }

  return {
    vocalId,
    reused: false,
    payload,
  }
}