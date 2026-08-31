import { randomUUID } from 'crypto'
import { uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'
import { getStudioCallbackUrl } from '@/lib/studio'

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

export async function createStudioPlayback(input: { sourceUrl: string; title?: string | null; composerId: string }) {
  const separated = await requestSunoPlayback(input.sourceUrl)
  const downloaded = await Promise.all([
    downloadBuffer(separated.instrumentalUrl),
    downloadBuffer(separated.vocalUrl),
  ])
  const playback = downloaded[0].buffer
  const vocals = downloaded[1].buffer
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
  return { ...uploaded, vocal: uploadedVocals, separationProvider: 'suno' as const }
}

export async function createAdminPlayback(input: { sourceUrl: string; title?: string | null }) {
  return createStudioPlayback({ ...input, composerId: 'admin-playback' })
}
