import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import type { Readable } from 'stream'
import { uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'

const MAX_ZIP_BYTES = 150 * 1024 * 1024
const MAX_STEM_BYTES = 80 * 1024 * 1024

export function findMurekaPlaybackStems(zip: JSZip) {
  const audio = Object.values(zip.files).filter((file) => !file.dir && /\.wav$/i.test(file.name) && !file.name.includes('__MACOSX/'))
  const name = (file: JSZip.JSZipObject) => file.name.split('/').pop()!.replace(/\.wav$/i, '').toLowerCase()
  const vocal = audio.find((file) => /^(vocals?|voice|acapp?ella)([ _-].*)?$/.test(name(file)))
  const instrumental = audio.find((file) => /^(instrumental|accompaniment|backing|no[ _-]?vocals?)([ _-].*)?$/.test(name(file)))
  if (!vocal || !instrumental) throw new Error('A Mureka não retornou o playback e a voz isolada esperados.')
  return { vocal, instrumental }
}

async function downloadZip(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('A Mureka retornou um link inválido.')
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(45_000) })
  if (!response.ok || !response.body) throw new Error('Não foi possível baixar a separação da Mureka.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_ZIP_BYTES) throw new Error('O resultado da separação excedeu o tamanho permitido.')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks)
}

async function readStem(file: JSZip.JSZipObject) {
  // JSZip exposes a stream so oversized decompressed files can be stopped early.
  const chunks: Buffer[] = []
  let length = 0
  await new Promise<void>((resolve, reject) => {
    const stream = file.nodeStream('nodebuffer') as Readable
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.on('data', (chunk: Buffer) => {
      length += chunk.length
      if (length > MAX_STEM_BYTES) {
        stream.destroy(new Error('Uma faixa separada excedeu o tamanho permitido.'))
        return
      }
      chunks.push(chunk)
    })
  })
  if (!length) throw new Error('A Mureka retornou uma faixa vazia.')
  const bytes = Buffer.concat(chunks)
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('A Mureka retornou uma faixa WAV inválida.')
  }
  return bytes
}

export async function createMurekaAdminPlayback(input: { sourceUrl: string; title?: string }) {
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey) throw new Error('A separação pela Mureka ainda não está configurada.')
  const response = await fetch('https://api.mureka.ai/v1/song/stem', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: input.sourceUrl, model: 'audio-separation-3' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(180_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.zip_url) {
    console.error('[Admin Mureka Playback] Separação recusada:', response.status, payload)
    throw new Error('A Mureka não conseguiu separar este áudio. Confira o arquivo e tente novamente.')
  }
  const zip = await JSZip.loadAsync(await downloadZip(String(payload.zip_url)))
  const stems = findMurekaPlaybackStems(zip)
  const title = (input.title || 'musica').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60) || 'musica'
  const id = randomUUID().slice(0, 8)
  const instrumental = await readStem(stems.instrumental)
  const uploaded = await uploadStudioAudioBuffer({ composerId: 'admin-playback', folder: 'exports', fileName: `${title}-playback-${id}.wav`, buffer: instrumental, contentType: 'audio/wav' })
  const vocals = await readStem(stems.vocal)
  const vocal = await uploadStudioAudioBuffer({ composerId: 'admin-playback', folder: 'exports', fileName: `${title}-voz-${id}.wav`, buffer: vocals, contentType: 'audio/wav' })
  return { ...uploaded, vocal, separationProvider: 'mureka' as const }
}
