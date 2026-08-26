import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import JSZip from 'jszip'
import { uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'

const execFileAsync = promisify(execFile)
const MAX_MUREKA_INLINE_BYTES = 10 * 1024 * 1024

function getMurekaApiKey() {
  return process.env.MUREKA_API_KEY?.trim() || ''
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

async function extractPlayback(zipUrl: string) {
  const downloaded = await downloadBuffer(zipUrl)
  const zip = await JSZip.loadAsync(downloaded.buffer)
  const audioFiles = Object.entries(zip.files).filter(([name, file]) =>
    !file.dir && /\.(mp3|wav|m4a|ogg)$/i.test(name)
  )
  const accompaniment = audioFiles.find(([name]) =>
    /accompaniment|instrumental|music|no.?vocal|karaoke/i.test(name)
  ) || audioFiles.find(([name]) => !/vocal|voice|sing/i.test(name))

  if (!accompaniment) throw new Error('A separação terminou, mas o playback não foi encontrado.')
  const [fileName, file] = accompaniment
  const raw = Buffer.from(await file.async('nodebuffer'))
  const extension = path.extname(fileName).slice(1).toLowerCase() || 'wav'
  return extension === 'mp3' ? raw : convertToMp3(raw, extension)
}

export async function createAdminPlayback(input: { sourceUrl: string; title?: string | null }) {
  const zipUrl = await requestPlaybackZip(input.sourceUrl)
  const playback = await extractPlayback(zipUrl)
  const cleanTitle = String(input.title || 'musica')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'musica'

  return uploadStudioAudioBuffer({
    composerId: 'admin-playback',
    folder: 'exports',
    fileName: `${cleanTitle}-playback-${randomUUID().slice(0, 8)}.mp3`,
    buffer: playback,
    contentType: 'audio/mpeg',
  })
}
