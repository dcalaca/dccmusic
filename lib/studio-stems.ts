import { createHash, randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import JSZip from 'jszip'
import {
  addStudioCreditTransaction,
  createUniqueProjectSlug,
  getStudioCallbackUrl,
  STUDIO_STEM_EXPORT_CREDITS,
  STUDIO_STEM_SEPARATION_CREDITS,
} from '@/lib/studio'
import {
  createStudioAudioSignedUrl,
  uploadStudioAudioBuffer,
} from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

const execFileAsync = promisify(execFile)

export type StemType = 'vocal' | 'drums' | 'bass' | 'others'

export type StoredStem = {
  id: string
  type: StemType
  name: string
  path: string
  storage_provider: 'r2' | 'supabase'
  source_url?: string | null
  volume: number
}

export type MixStemState = {
  id: string
  type: StemType
  volume: number
  muted: boolean
  solo: boolean
}

export type MixTrim = {
  startSec: number
  endSec: number | null
}

function getSunoApiKey() {
  return process.env.SUNOAPI_KEY?.trim() || process.env.SUNO_API_KEY?.trim() || ''
}

function getMurekaApiKey() {
  return process.env.MUREKA_API_KEY?.trim() || ''
}

function classifyStemName(rawName: string): StemType {
  const name = rawName.toLowerCase()
  if (/(vocal|voice|sing|lead vocal|backing vocal)/.test(name)) return 'vocal'
  if (/(drum|perc|hi-?hat|cymbal|808|kick|snare)/.test(name)) return 'drums'
  if (/(bass|contrabaixo)/.test(name)) return 'bass'
  return 'others'
}

function stemDisplayName(type: StemType) {
  if (type === 'vocal') return 'Vocal'
  if (type === 'drums') return 'Drums'
  if (type === 'bass') return 'Bass'
  return 'Others'
}

async function downloadBuffer(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Falha ao baixar áudio (${response.status})`)
  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}

export function normalizeMixTrim(trim?: MixTrim | null): MixTrim {
  const startSec = Math.max(0, Number(trim?.startSec) || 0)
  const rawEnd = trim?.endSec
  const endSec =
    rawEnd == null || !Number.isFinite(Number(rawEnd))
      ? null
      : Math.max(startSec + 0.1, Number(rawEnd))
  return {
    startSec: Math.round(startSec * 10) / 10,
    endSec: endSec == null ? null : Math.round(endSec * 10) / 10,
  }
}

export function buildMixFingerprint(
  jobId: string,
  stems: MixStemState[],
  trim?: MixTrim | null
) {
  const normalized = [...stems]
    .map((stem) => ({
      id: stem.id,
      type: stem.type,
      volume: Math.round(Number(stem.volume) || 0),
      muted: Boolean(stem.muted),
      solo: Boolean(stem.solo),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  return createHash('sha256')
    .update(JSON.stringify({
      jobId,
      stems: normalized,
      trim: normalizeMixTrim(trim),
    }))
    .digest('hex')
}

export async function chargeStemSeparation(input: {
  composerId: string
  projectId?: string | null
  jobId: string
}) {
  const transaction = await addStudioCreditTransaction({
    composerId: input.composerId,
    projectId: input.projectId,
    action: 'stem_separation',
    amount: STUDIO_STEM_SEPARATION_CREDITS,
    description: 'Separação de instrumentos no DCC Studio',
    metadata: { jobId: input.jobId },
  })

  await supabaseAdmin
    .from('studio_stem_jobs')
    .update({
      separation_charged: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.jobId)

  return transaction
}

export async function refundStemSeparation(input: {
  composerId: string
  projectId?: string | null
  jobId: string
  reason?: string
}) {
  const { data: job } = await supabaseAdmin
    .from('studio_stem_jobs')
    .select('id, separation_charged, separation_refunded')
    .eq('id', input.jobId)
    .maybeSingle()

  if (!job?.separation_charged || job.separation_refunded) {
    return { refunded: false }
  }

  await addStudioCreditTransaction({
    composerId: input.composerId,
    projectId: input.projectId,
    action: 'stem_separation_refund',
    amount: STUDIO_STEM_SEPARATION_CREDITS,
    description: 'Estorno: falha na separação de instrumentos',
    metadata: { jobId: input.jobId, reason: input.reason || null },
  })

  await supabaseAdmin
    .from('studio_stem_jobs')
    .update({
      separation_refunded: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.jobId)

  return { refunded: true }
}

export async function chargeStemExport(input: {
  composerId: string
  projectId?: string | null
  jobId: string
  fingerprint: string
  versionId?: string | null
}) {
  const transaction = await addStudioCreditTransaction({
    composerId: input.composerId,
    projectId: input.projectId,
    action: 'stem_export',
    amount: STUDIO_STEM_EXPORT_CREDITS,
    description: 'Exportar mix do DCC Studio',
    metadata: {
      jobId: input.jobId,
      fingerprint: input.fingerprint,
      versionId: input.versionId || null,
    },
  })
  return transaction
}

async function backupStemFromUrl(input: {
  composerId: string
  jobId: string
  type: StemType
  sourceUrl: string
}) {
  const downloaded = await downloadBuffer(input.sourceUrl)
  const uploaded = await uploadStudioAudioBuffer({
    composerId: input.composerId,
    folder: 'stems',
    fileName: `${input.jobId}-${input.type}-${randomUUID()}.mp3`,
    buffer: downloaded.buffer,
    contentType: downloaded.contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg',
  })

  return {
    id: `${input.type}-${randomUUID().slice(0, 8)}`,
    type: input.type,
    name: stemDisplayName(input.type),
    path: uploaded.path,
    storage_provider: uploaded.provider,
    source_url: input.sourceUrl,
    volume: input.type === 'vocal' ? 80 : 70,
  } satisfies StoredStem
}

/** Agrupa URLs do provedor nas 4 faixas do MVP (Vocal/Drums/Bass/Others). */
export async function persistMappedStems(input: {
  composerId: string
  jobId: string
  entries: Array<{ name: string; url: string }>
}) {
  const buckets: Record<StemType, string[]> = {
    vocal: [],
    drums: [],
    bass: [],
    others: [],
  }

  for (const entry of input.entries) {
    if (!entry.url) continue
    buckets[classifyStemName(entry.name)].push(entry.url)
  }

  // Garante as 4 faixas: se um bucket ficou vazio, usa a primeira URL disponível como placeholder silencioso? 
  // Melhor: só persiste buckets com URL; UI completa com stubs sem áudio se faltar.
  const types: StemType[] = ['vocal', 'drums', 'bass', 'others']
  const stems: StoredStem[] = []

  for (const type of types) {
    const url = buckets[type][0] || null
    if (!url) {
      stems.push({
        id: `${type}-empty`,
        type,
        name: stemDisplayName(type),
        path: '',
        storage_provider: 'r2',
        source_url: null,
        volume: type === 'vocal' ? 80 : 70,
      })
      continue
    }
    stems.push(await backupStemFromUrl({
      composerId: input.composerId,
      jobId: input.jobId,
      type,
      sourceUrl: url,
    }))
  }

  // Se Others tem várias fontes e a primeira já foi salva, ok para MVP.
  // Se vocal/drums/bass vazios mas others tem tudo, ainda mostramos faixas vazias.

  const playable = stems.filter((stem) => stem.path)
  if (playable.length === 0) {
    throw new Error('Nenhum stem válido retornado pelo provedor.')
  }

  return stems
}

function parseSunoStemEntries(info: any): Array<{ name: string; url: string }> {
  if (!info || typeof info !== 'object') return []
  const entries: Array<{ name: string; url: string }> = []

  for (const [key, value] of Object.entries(info)) {
    if (typeof value !== 'string' || !value.startsWith('http')) continue
    if (key === 'origin_url') continue
    const name = key.replace(/_url$/i, '').replace(/_/g, ' ')
    entries.push({ name, url: value })
  }

  // Formato advanced: arrays extract/remove
  if (Array.isArray(info)) {
    for (const item of info) {
      const extractUrl = item?.extract?.audio_url || item?.audio_url
      const extractName = item?.extract?.stem_type_group_name || item?.stem_type_group_name || item?.name || 'stem'
      if (extractUrl) entries.push({ name: String(extractName), url: String(extractUrl) })
    }
  }

  return entries
}

function isSignedOrPrivateStorageUrl(url: string) {
  const value = String(url || '').toLowerCase()
  return (
    value.includes('x-amz-signature') ||
    value.includes('x-amz-credential') ||
    value.includes('x-amz-algorithm') ||
    value.includes('token=') ||
    value.includes('/object/sign/') ||
    value.includes('supabase.co/storage') ||
    value.includes('r2.cloudflarestorage.com')
  )
}

function isPublicProviderAudioUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return false
  if (isSignedOrPrivateStorageUrl(url)) return false
  return true
}

function extractSunoAudioId(version: any, generation?: any) {
  return (
    generation?.provider_audio_id ||
    version?.provider_payload?.id ||
    version?.provider_payload?.audio_id ||
    version?.provider_payload?.audioId ||
    null
  )
}

export async function uploadAudioBufferToSunoTemp(input: {
  buffer: Buffer
  fileName?: string
  contentType?: string
}) {
  const apiKey = getSunoApiKey()
  if (!apiKey) throw new Error('SUNOAPI_KEY não configurada.')

  const fileName = input.fileName || `stem-source-${randomUUID()}.mp3`
  const contentType = input.contentType || 'audio/mpeg'
  const endpoints = [
    'https://api.sunoapi.org/api/file-stream-upload',
    'https://sunoapiorg.redpandaai.co/api/file-stream-upload',
  ]

  let lastError = 'Falha ao enviar áudio temporário para a Suno.'
  for (const endpoint of endpoints) {
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: contentType }),
      fileName
    )
    form.append('uploadPath', 'dcc-studio/stems')
    form.append('fileName', fileName)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    const downloadUrl =
      payload?.data?.downloadUrl ||
      payload?.data?.download_url ||
      payload?.downloadUrl

    if (response.ok && downloadUrl) {
      return { downloadUrl: String(downloadUrl), payload }
    }

    lastError = payload?.msg || payload?.error || `Upload Suno falhou (${response.status})`
  }

  throw new Error(lastError)
}

/**
 * Prepara uma fonte aceita pelos provedores:
 * 1) taskId+audioId da geração Suno (melhor)
 * 2) URL pública do provedor
 * 3) reupload do nosso áudio para tempfile da Suno
 */
export async function prepareStemSeparationSource(input: {
  version?: any | null
  sourceAudioUrl?: string | null
  sourceAudioPath?: string | null
  sourceAudioStorageProvider?: string | null
}) {
  let generation: any = null
  if (input.version?.generation_id) {
    const { data } = await supabaseAdmin
      .from('studio_generations')
      .select('id, provider, provider_task_id, provider_audio_id, response_payload')
      .eq('id', input.version.generation_id)
      .maybeSingle()
    generation = data
  }

  const sunoTaskId = generation?.provider_task_id || null
  const sunoAudioId = extractSunoAudioId(input.version, generation)
  const sunoNative =
    sunoTaskId && sunoAudioId
      ? { taskId: String(sunoTaskId), audioId: String(sunoAudioId) }
      : null

  const candidateUrls = [
    input.version?.audio_url,
    input.version?.stream_audio_url,
    input.sourceAudioUrl,
  ].filter((url): url is string => Boolean(url && String(url).startsWith('http')))

  let publicAudioUrl = candidateUrls.find((url) => isPublicProviderAudioUrl(url)) || null

  if (!publicAudioUrl) {
    const localUrl =
      (input.sourceAudioPath
        ? await createStudioAudioSignedUrl(input.sourceAudioPath, input.sourceAudioStorageProvider)
        : null) ||
      input.sourceAudioUrl ||
      candidateUrls[0] ||
      null

    if (!localUrl) {
      throw new Error('Não foi possível localizar o áudio para separar.')
    }

    const downloaded = await downloadBuffer(localUrl)
    if (downloaded.buffer.byteLength > 20 * 1024 * 1024) {
      throw new Error('O áudio precisa ter no máximo 20 MB para separar instrumentos.')
    }

    const uploaded = await uploadAudioBufferToSunoTemp({
      buffer: downloaded.buffer,
      fileName: `stem-${randomUUID()}.mp3`,
      contentType: downloaded.contentType,
    })
    publicAudioUrl = uploaded.downloadUrl
  }

  return {
    sunoNative,
    publicAudioUrl,
    generationId: generation?.id || null,
  }
}

export async function requestSunoStemSeparation(input: {
  audioUrl?: string | null
  taskId?: string | null
  audioId?: string | null
}) {
  const apiKey = getSunoApiKey()
  if (!apiKey) throw new Error('SUNOAPI_KEY não configurada.')

  const body: Record<string, any> = {
    type: 'split_stem',
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/stem-callback'),
  }

  if (input.taskId && input.audioId) {
    body.taskId = input.taskId
    body.audioId = input.audioId
  } else if (input.audioUrl) {
    body.audioUrl = input.audioUrl
  } else {
    throw new Error('Fonte de áudio inválida para a Suno.')
  }

  const response = await fetch('https://api.sunoapi.org/api/v1/vocal-removal/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  // Alguns provedores retornam HTTP 200 com code != 200
  if (!response.ok || (payload?.code != null && Number(payload.code) !== 200)) {
    throw new Error(payload?.msg || payload?.error || `Suno stem falhou (${response.status})`)
  }

  const taskId = payload?.data?.taskId || payload?.data?.task_id || payload?.taskId
  if (!taskId) throw new Error('Suno não retornou taskId da separação.')
  return { taskId: String(taskId), payload }
}

export async function requestMurekaStemSeparation(audioUrl: string) {
  const apiKey = getMurekaApiKey()
  if (!apiKey) throw new Error('MUREKA_API_KEY não configurada.')

  const response = await fetch('https://api.mureka.ai/v1/song/stem', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Mureka stem falhou (${response.status})`)
  }

  const zipUrl = payload?.zip_url || payload?.data?.zip_url
  if (!zipUrl) throw new Error('Mureka não retornou zip_url dos stems.')
  return { zipUrl: String(zipUrl), payload }
}

export async function stemsFromMurekaZip(input: {
  composerId: string
  jobId: string
  zipUrl: string
}) {
  const zipDownloaded = await downloadBuffer(input.zipUrl)
  const zip = await JSZip.loadAsync(zipDownloaded.buffer)
  const uploadedEntries: Array<{ name: string; path: string; provider: 'r2' | 'supabase' }> = []

  for (const [fileName, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (!/\.(mp3|wav|m4a|ogg)$/i.test(fileName)) continue
    const buffer = Buffer.from(await file.async('nodebuffer'))
    const base = path.basename(fileName)
    const uploaded = await uploadStudioAudioBuffer({
      composerId: input.composerId,
      folder: 'stems',
      fileName: `${input.jobId}-mureka-${randomUUID()}-${base}`,
      buffer,
      contentType: base.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
    })
    uploadedEntries.push({ name: base, path: uploaded.path, provider: uploaded.provider })
  }

  if (uploadedEntries.length === 0) {
    throw new Error('ZIP da Mureka sem faixas de áudio.')
  }

  // Reusa classificação; para paths locais já no bucket, montamos StoredStem direto.
  const buckets: Record<StemType, typeof uploadedEntries> = {
    vocal: [],
    drums: [],
    bass: [],
    others: [],
  }
  for (const entry of uploadedEntries) {
    buckets[classifyStemName(entry.name)].push(entry)
  }

  const types: StemType[] = ['vocal', 'drums', 'bass', 'others']
  return types.map((type) => {
    const hit = buckets[type][0]
    if (!hit) {
      return {
        id: `${type}-empty`,
        type,
        name: stemDisplayName(type),
        path: '',
        storage_provider: 'r2' as const,
        source_url: null,
        volume: type === 'vocal' ? 80 : 70,
      } satisfies StoredStem
    }
    return {
      id: `${type}-${randomUUID().slice(0, 8)}`,
      type,
      name: stemDisplayName(type),
      path: hit.path,
      storage_provider: hit.provider,
      source_url: input.zipUrl,
      volume: type === 'vocal' ? 80 : 70,
    } satisfies StoredStem
  })
}

export async function markJobReady(jobId: string, stems: StoredStem[], provider: 'suno' | 'mureka', providerPayload?: any) {
  const { error } = await supabaseAdmin
    .from('studio_stem_jobs')
    .update({
      status: 'ready',
      provider,
      stems,
      provider_payload: providerPayload || null,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) throw error
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  await supabaseAdmin
    .from('studio_stem_jobs')
    .update({
      status: 'failed',
      error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function applySunoStemCallback(body: any) {
  const taskId = body?.data?.task_id || body?.data?.taskId || body?.task_id || body?.taskId
  if (!taskId) return { processed: false, error: 'taskId ausente' }

  const { data: job } = await supabaseAdmin
    .from('studio_stem_jobs')
    .select('*')
    .eq('provider_task_id', String(taskId))
    .maybeSingle()

  if (!job) return { processed: false, error: 'job não encontrado' }
  if (job.status === 'ready') return { processed: true, skipped: true }

  const code = Number(body?.code)
  const info = body?.data?.vocal_removal_info || body?.data?.data?.vocal_removal_info || body?.vocal_removal_info
  const entries = parseSunoStemEntries(info)
  const failed = Number.isFinite(code) && code !== 200 && entries.length === 0

  if (failed || entries.length === 0) {
    try {
      const audioUrl = job.source_audio_url
      if (!audioUrl) throw new Error('Sem URL de origem para fallback Mureka.')
      const mureka = await requestMurekaStemSeparation(audioUrl)
      const stems = await stemsFromMurekaZip({
        composerId: job.composer_id,
        jobId: job.id,
        zipUrl: mureka.zipUrl,
      })
      await markJobReady(job.id, stems, 'mureka', { sunoCallback: body, mureka: mureka.payload })
      return { processed: true, provider: 'mureka' }
    } catch (fallbackError: any) {
      const message = fallbackError?.message || 'Falha Suno e Mureka na separação.'
      await markJobFailed(job.id, message)
      await refundStemSeparation({
        composerId: job.composer_id,
        projectId: job.project_id,
        jobId: job.id,
        reason: message,
      })
      return { processed: true, failed: true, error: message }
    }
  }

  try {
    const stems = await persistMappedStems({
      composerId: job.composer_id,
      jobId: job.id,
      entries,
    })
    await markJobReady(job.id, stems, 'suno', body)
    return { processed: true, provider: 'suno' }
  } catch (error: any) {
    const message = error?.message || 'Erro ao salvar stems Suno.'
    try {
      const audioUrl = job.source_audio_url
      if (!audioUrl) throw new Error(message)
      const mureka = await requestMurekaStemSeparation(audioUrl)
      const stems = await stemsFromMurekaZip({
        composerId: job.composer_id,
        jobId: job.id,
        zipUrl: mureka.zipUrl,
      })
      await markJobReady(job.id, stems, 'mureka', { sunoError: message, mureka: mureka.payload })
      return { processed: true, provider: 'mureka' }
    } catch (fallbackError: any) {
      const finalMessage = fallbackError?.message || message
      await markJobFailed(job.id, finalMessage)
      await refundStemSeparation({
        composerId: job.composer_id,
        projectId: job.project_id,
        jobId: job.id,
        reason: finalMessage,
      })
      return { processed: true, failed: true, error: finalMessage }
    }
  }
}

export async function resolveStemSignedUrls(stems: StoredStem[]) {
  return Promise.all(
    (stems || []).map(async (stem) => ({
      ...stem,
      url: stem.path
        ? await createStudioAudioSignedUrl(stem.path, stem.storage_provider)
        : null,
    }))
  )
}

function resolveFfmpegPath() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const installer = require('@ffmpeg-installer/ffmpeg')
    return installer.path as string
  } catch {
    return process.env.FFMPEG_PATH || 'ffmpeg'
  }
}

export async function mixStemsWithFfmpeg(input: {
  composerId: string
  jobId: string
  stems: StoredStem[]
  mix: MixStemState[]
  trim?: MixTrim | null
}) {
  const anySolo = input.mix.some((stem) => stem.solo)
  const active = input.mix.filter((stem) => {
    const stored = input.stems.find((item) => item.id === stem.id || item.type === stem.type)
    if (!stored?.path) return false
    if (stem.muted) return false
    if (anySolo && !stem.solo) return false
    return (Number(stem.volume) || 0) > 0
  })

  if (active.length === 0) {
    throw new Error('Nenhuma faixa ativa para exportar. Desmute ao menos um instrumento.')
  }

  const trim = normalizeMixTrim(input.trim)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-stem-mix-'))
  const inputFiles: string[] = []
  const filterParts: string[] = []
  const mixLabels: string[] = []

  try {
    for (const [index, stemState] of active.entries()) {
      const stored = input.stems.find((item) => item.id === stemState.id || item.type === stemState.type)
      if (!stored?.path) continue
      const signed = await createStudioAudioSignedUrl(stored.path, stored.storage_provider)
      if (!signed) throw new Error(`Não foi possível ler o stem ${stored.name}.`)
      const downloaded = await downloadBuffer(signed)
      const filePath = path.join(tmpDir, `in-${index}.mp3`)
      await fs.writeFile(filePath, downloaded.buffer)
      inputFiles.push(filePath)
      const vol = Math.max(0, Math.min(2, (Number(stemState.volume) || 0) / 100))
      filterParts.push(`[${index}:a]volume=${vol}[a${index}]`)
      mixLabels.push(`[a${index}]`)
    }

    const trimFilter =
      trim.startSec > 0 || trim.endSec != null
        ? trim.endSec == null
          ? `;[aout]atrim=start=${trim.startSec},asetpts=PTS-STARTPTS[acut]`
          : `;[aout]atrim=start=${trim.startSec}:end=${trim.endSec},asetpts=PTS-STARTPTS[acut]`
        : ''
    const mapLabel = trimFilter ? '[acut]' : '[aout]'

    const outPath = path.join(tmpDir, 'mix.mp3')
    const ffmpegPath = resolveFfmpegPath()
    const args = [
      ...inputFiles.flatMap((file) => ['-i', file]),
      '-filter_complex',
      `${filterParts.join(';')};${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0[aout]${trimFilter}`,
      '-map',
      mapLabel,
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      '-y',
      outPath,
    ]

    await execFileAsync(ffmpegPath, args, { maxBuffer: 20 * 1024 * 1024 })
    const mixed = await fs.readFile(outPath)
    const uploaded = await uploadStudioAudioBuffer({
      composerId: input.composerId,
      folder: 'exports',
      fileName: `${input.jobId}-mix-${randomUUID()}.mp3`,
      buffer: mixed,
      contentType: 'audio/mpeg',
    })

    return uploaded
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function ensureProjectForStemJob(job: any) {
  if (job.project_id) {
    const { data } = await supabaseAdmin
      .from('studio_projects')
      .select('*')
      .eq('id', job.project_id)
      .maybeSingle()
    if (data) return data
  }

  const title = job.source_title || 'Mix Studio'
  const slug = await createUniqueProjectSlug(job.composer_id, title)
  const { data: project, error } = await supabaseAdmin
    .from('studio_projects')
    .insert({
      composer_id: job.composer_id,
      title,
      slug,
      status: 'draft',
      description: 'Projeto criado a partir do DCC Studio Mixer (upload/separação).',
    })
    .select('*')
    .maybeSingle()

  if (error) throw error

  await supabaseAdmin
    .from('studio_stem_jobs')
    .update({ project_id: project.id, updated_at: new Date().toISOString() })
    .eq('id', job.id)

  return project
}

export { parseSunoStemEntries }
