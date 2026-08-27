import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import JSZip from 'jszip'
import { uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'
import { getStudioCallbackUrl } from '@/lib/studio'

const execFileAsync = promisify(execFile)
const MAX_MUREKA_INLINE_BYTES = 10 * 1024 * 1024

function getMurekaApiKey() {
  return process.env.MUREKA_API_KEY?.trim() || ''
}

function getSunoApiKey() {
  return process.env.SUNOAPI_KEY?.trim() || process.env.SUNO_API_KEY?.trim() || ''
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function downloadBuffer(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Falha ao baixar o áudio (${response.status}).`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error('O áudio recebido está vazio.')
  return { buffer, contentType: response.headers.get('content-type') || 'audio/mpeg' }
}

function resolveFfmpegPath() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@ffmpeg-installer/ffmpeg').path as string
  } catch {
    return process.env.FFMPEG_PATH || 'ffmpeg'
  }
}

async function convertToMp3(buffer: Buffer, sourceExtension: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-playback-'))
  const inputPath = path.join(tempDir, `input.${sourceExtension || 'wav'}`)
  const outputPath = path.join(tempDir, 'playback.mp3')
  try {
    await fs.writeFile(inputPath, buffer)
    await execFileAsync(
      resolveFfmpegPath(),
      ['-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-y', outputPath],
      { maxBuffer: 20 * 1024 * 1024 }
    )
    return await fs.readFile(outputPath)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function requestPlaybackZip(sourceUrl: string) {
  const apiKey = getMurekaApiKey()
  if (!apiKey) throw new Error('MUREKA_API_KEY não configurada.')

  const downloaded = await downloadBuffer(sourceUrl)
  if (downloaded.buffer.byteLength > MAX_MUREKA_INLINE_BYTES) {
    throw new Error('Para retirar a voz, o arquivo precisa ter no máximo 10 MB.')
  }

  const dataUrl = `data:audio/mp3;base64,${downloaded.buffer.toString('base64')}`
  const response = await fetch('https://api.mureka.ai/v1/song/stem', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: dataUrl, model: 'audio-separation-3' }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  const zipUrl = payload?.zip_url || payload?.data?.zip_url
  if (!response.ok || !zipUrl) {
    throw new Error(payload?.error?.message || payload?.message || payload?.msg || `Falha ao retirar a voz (${response.status}).`)
  }
  return String(zipUrl)
}

async function requestSunoPlayback(sourceUrl: string) {
  const apiKey = getSunoApiKey()
  if (!apiKey) throw new Error('SUNOAPI_KEY não configurada.')

  const createResponse = await fetch('https://api.sunoapi.org/api/v1/vocal-removal/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioUrl: sourceUrl,
      type: 'separate_vocal',
      callBackUrl: getStudioCallbackUrl('/api/admin/playback/suno-callback'),
    }),
    cache: 'no-store',
  })
  const createPayload = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok || Number(createPayload?.code) !== 200) {
    throw new Error(createPayload?.msg || createPayload?.error || `Suno não iniciou a separação (${createResponse.status}).`)
  }

  const taskId = createPayload?.data?.taskId || createPayload?.data?.task_id
  if (!taskId) throw new Error('Suno não retornou o código da separação.')

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (attempt > 0) await wait(3000)
    const statusResponse = await fetch(
      `https://api.sunoapi.org/api/v1/vocal-removal/record-info?taskId=${encodeURIComponent(String(taskId))}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    const statusPayload = await statusResponse.json().catch(() => ({}))
    if (!statusResponse.ok || Number(statusPayload?.code) !== 200) {
      throw new Error(statusPayload?.msg || statusPayload?.error || `Erro ao consultar a separação Suno (${statusResponse.status}).`)
    }

    const data = statusPayload?.data || {}
    const status = String(data?.successFlag || '').toUpperCase()
    const instrumentalUrl = data?.response?.instrumentalUrl || data?.response?.instrumental_url
    const vocalUrl = data?.response?.vocalUrl || data?.response?.vocal_url
    if (status === 'SUCCESS' && instrumentalUrl) {
      if (!vocalUrl) {
        throw new Error('A Suno concluiu a separação, mas não retornou a voz isolada.')
      }
      return {
        instrumentalUrl: String(instrumentalUrl),
        vocalUrl: String(vocalUrl),
      }
    }
    if (status && !['PENDING', 'PROCESSING'].includes(status)) {
      throw new Error(data?.errorMessage || `A separação Suno falhou (${status}).`)
    }
  }

  throw new Error('A Suno demorou demais para concluir a separação.')
}

async function extractStemFile(entry: [string, JSZip.JSZipObject]) {
  const [fileName, file] = entry
  const raw = Buffer.from(await file.async('nodebuffer'))
  const extension = path.extname(fileName).slice(1).toLowerCase() || 'wav'
  return extension === 'mp3' ? raw : convertToMp3(raw, extension)
}

async function extractStemPair(zipUrl: string) {
  const downloaded = await downloadBuffer(zipUrl)
  const zip = await JSZip.loadAsync(downloaded.buffer)
  const audioFiles = Object.entries(zip.files).filter(([name, file]) =>
    !file.dir && /\.(mp3|wav|m4a|ogg)$/i.test(name)
  )
  const accompaniment = audioFiles.find(([name]) =>
    /accompaniment|instrumental|music|no.?vocal|karaoke/i.test(name)
  ) || audioFiles.find(([name]) => !/vocal|voice|sing/i.test(name))
  const vocal = audioFiles.find(([name]) => /vocal|voice|sing/i.test(name) && !/no.?vocal/i.test(name))

  if (!accompaniment) throw new Error('A separação terminou, mas o playback não foi encontrado.')
  if (!vocal) throw new Error('A separação terminou, mas a voz isolada não foi encontrada.')
  const [playback, vocals] = await Promise.all([
    extractStemFile(accompaniment),
    extractStemFile(vocal),
  ])
  return { playback, vocals }
}

export async function createStudioPlayback(input: { sourceUrl: string; title?: string | null; composerId: string }) {
  let playback: Buffer
  let vocals: Buffer
  let separationProvider: 'suno' | 'mureka' = 'suno'
  try {
    const separated = await requestSunoPlayback(input.sourceUrl)
    const downloaded = await Promise.all([
      downloadBuffer(separated.instrumentalUrl),
      downloadBuffer(separated.vocalUrl),
    ])
    playback = downloaded[0].buffer
    vocals = downloaded[1].buffer
  } catch (sunoError: any) {
    console.error('[Studio Playback] Suno falhou ou retornou separação incompleta; usando Mureka:', sunoError?.message || sunoError)
    separationProvider = 'mureka'
    const zipUrl = await requestPlaybackZip(input.sourceUrl)
    const extracted = await extractStemPair(zipUrl)
    playback = extracted.playback
    vocals = extracted.vocals
  }
  const cleanTitle = String(input.title || 'musica')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'musica'

  const [uploaded, uploadedVocals] = await Promise.all([
    uploadStudioAudioBuffer({
      composerId: input.composerId,
      folder: 'exports',
      fileName: `${cleanTitle}-playback-${randomUUID().slice(0, 8)}.mp3`,
      buffer: playback,
      contentType: 'audio/mpeg',
    }),
    uploadStudioAudioBuffer({
      composerId: input.composerId,
      folder: 'exports',
      fileName: `${cleanTitle}-voz-${randomUUID().slice(0, 8)}.mp3`,
      buffer: vocals,
      contentType: 'audio/mpeg',
    }),
  ])
  return { ...uploaded, vocal: uploadedVocals, separationProvider }
}

export async function createAdminPlayback(input: { sourceUrl: string; title?: string | null }) {
  return createStudioPlayback({ ...input, composerId: 'admin-playback' })
}
