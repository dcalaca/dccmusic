import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { addStudioCreditTransaction } from '@/lib/studio'
import { getComposerStatement } from '@/lib/composer-statement'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { saveMurekaTranscriptionZip, readTranscriptionTextFile } from '@/lib/music-transcription-storage'
import { buildMusicXmlChordPreview } from '@/lib/musicxml-chord-preview'

export const dynamic = 'force-dynamic'

const TRANSCRIPTION_CREDITS = 25
const MAX_MANUAL_AUDIO_BYTES = 50 * 1024 * 1024

function cleanStudioMusicTitle(value?: string | null) {
  const title = String(value || '').trim()
  if (!title) return 'Música Studio IA'

  const [firstPart, ...rest] = title.split(' - ')
  const details = rest.join(' - ').toLowerCase()

  if (
    firstPart?.trim() &&
    (
      details.includes('música gerada') ||
      details.includes('versão') ||
      details.includes('clima ') ||
      details.includes('produção ') ||
      details.includes('vocal ') ||
      details.includes('mixagem ') ||
      details.includes('sertanejo') ||
      details.includes('pagode') ||
      details.includes('funk') ||
      details.includes('mpb') ||
      details.includes('forró') ||
      details.includes('gospel')
    )
  ) {
    return firstPart.trim()
  }

  return title
}

function formatMusicTitle(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s([{'"-])(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`)
}

function getMurekaApiKey() {
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey) throw new Error('MUREKA_API_KEY não configurada no servidor.')
  return apiKey
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function extractMurekaUploadAudioId(payload: any) {
  return firstString(
    payload?.upload_audio_id,
    payload?.uploadAudioId,
    payload?.id,
    payload?.file_id,
    payload?.data?.upload_audio_id,
    payload?.data?.uploadAudioId,
    payload?.data?.id,
    payload?.data?.file_id,
    payload?.result?.upload_audio_id,
    payload?.result?.id
  )
}

function extractMurekaResultPayload(payload: any) {
  return payload?.data || payload?.result || payload || {}
}

function isAllowedManualAudio(file: File) {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return type.startsWith('audio/') ||
    ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].some((extension) => name.endsWith(extension))
}

async function uploadManualAudioToMureka(file: File, arrayBuffer: ArrayBuffer) {
  const formData = new FormData()
  formData.append('purpose', 'audio')
  formData.append('file', new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' }), file.name || 'audio.mp3')

  const response = await fetch('https://api.mureka.ai/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getMurekaApiKey()}`,
    },
    body: formData,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  const uploadAudioId = extractMurekaUploadAudioId(payload)

  if (!response.ok || !uploadAudioId) {
    throw new Error(payload?.error?.message || payload?.message || 'Não consegui subir o áudio para transcrição.')
  }

  return { uploadAudioId, uploadPayload: payload }
}

async function requestMurekaTranscription(input: { type: 'upload_audio_id' | 'url'; value: string }) {
  const response = await fetch('https://api.mureka.ai/v1/song/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getMurekaApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ [input.type]: input.value }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  const result = extractMurekaResultPayload(payload)
  const zipUrl = result?.zip_url || payload?.zip_url || null

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || result?.message || 'A transcrição não foi aceita pelo fornecedor.')
  }

  if (!zipUrl) {
    throw new Error('A transcrição foi processada, mas não retornou os arquivos esperados.')
  }

  return { payload, zipUrl }
}

async function getExistingCompleted(composerId: string, sourceType: string, sourceHash: string) {
  const { data, error } = await supabaseAdmin
    .from('music_transcriptions')
    .select('*')
    .eq('composer_id', composerId)
    .eq('source_type', sourceType)
    .eq('source_hash', sourceHash)
    .maybeSingle()

  if (error) throw error
  return data?.status === 'completed' ? data : null
}

async function requireCredits(composerId: string) {
  const statement = await getComposerStatement(composerId)
  const balance = Number(statement?.summary?.currentCreditBalance) || 0
  if (balance < TRANSCRIPTION_CREDITS) {
    throw new Error(`Saldo insuficiente para gerar partitura e cifra. Faça uma recarga para continuar. Seu saldo atual é ${balance} créditos.`)
  }
  return balance
}

async function createProcessingRecord(input: {
  composerId: string
  sourceType: 'studio_version' | 'manual_upload'
  sourceHash: string
  title: string
  studioProjectId?: string | null
  studioVersionId?: string | null
  metadata?: any
}) {
  const { data, error } = await supabaseAdmin
    .from('music_transcriptions')
    .insert({
      composer_id: input.composerId,
      source_type: input.sourceType,
      source_hash: input.sourceHash,
      studio_project_id: input.studioProjectId || null,
      studio_version_id: input.studioVersionId || null,
      title: input.title,
      status: 'processing',
      credits_charged: 0,
      metadata: input.metadata || {},
    })
    .select('*')
    .single()

  if (!error) return data
  if (error.code === '23505') {
    const existing = await getExistingCompleted(input.composerId, input.sourceType, input.sourceHash)
    if (existing) return existing
  }
  throw error
}

async function completeTranscription(input: {
  record: any
  composerId: string
  title: string
  providerInputType: 'upload_audio_id' | 'url'
  providerInputValue: string
  providerPayload: any
  zipUrl: string
  projectId?: string | null
  metadata?: any
}) {
  const files = await saveMurekaTranscriptionZip({
    composerId: input.composerId,
    transcriptionId: input.record.id,
    title: input.title,
    zipUrl: input.zipUrl,
  })
  const musicXml = await readTranscriptionTextFile(files.musicXmlPath)
  const preview = buildMusicXmlChordPreview(musicXml, input.title)

  const { data: saved, error: updateError } = await supabaseAdmin
    .from('music_transcriptions')
    .update({
      status: 'completed',
      credits_charged: TRANSCRIPTION_CREDITS,
      provider_input_type: input.providerInputType,
      provider_input_value: input.providerInputValue,
      pdf_path: files.pdfPath,
      pdf_storage_provider: files.storageProvider,
      musicxml_path: files.musicXmlPath,
      musicxml_storage_provider: files.storageProvider,
      zip_path: files.zipPath,
      zip_storage_provider: files.storageProvider,
      preview_text: preview.preview,
      preview_payload: {
        key: preview.key,
        bpm: preview.bpm,
        stats: preview.stats,
        warnings: preview.warnings,
      },
      provider_payload: input.providerPayload,
      metadata: {
        ...(input.record.metadata || {}),
        ...(input.metadata || {}),
        fileNames: {
          pdf: files.pdfFileName,
          musicxml: files.musicXmlFileName,
          zip: files.zipFileName,
        },
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', input.record.id)
    .select('*')
    .single()

  if (updateError) throw updateError

  await addStudioCreditTransaction({
    composerId: input.composerId,
    projectId: input.projectId || null,
    action: 'music_transcription',
    amount: TRANSCRIPTION_CREDITS,
    description: `Partitura e cifra: ${input.title}`,
    metadata: {
      transcriptionId: input.record.id,
      sourceType: input.record.source_type,
      sourceHash: input.record.source_hash,
      creditCost: TRANSCRIPTION_CREDITS,
    },
  })

  return saved
}

function mapTranscription(row: any) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    creditsCharged: Number(row.credits_charged) || 0,
    previewText: row.preview_text || null,
    previewPayload: row.preview_payload || {},
    createdAt: row.created_at,
    completedAt: row.completed_at,
    hasFiles: Boolean(row.pdf_path && row.musicxml_path && row.zip_path),
  }
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('music_transcriptions')
      .select('*')
      .eq('composer_id', composer.composerId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    return NextResponse.json({
      transcriptions: (data || []).map(mapTranscription),
      cost: TRANSCRIPTION_CREDITS,
    })
  } catch (error: any) {
    console.error('[Music Transcription] Erro listar transcrições:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar transcrições.' },
      { status: 500 }
    )
  }
}

async function failRecord(recordId: string, error: any) {
  try {
    await supabaseAdmin
      .from('music_transcriptions')
      .update({
        status: 'failed',
        error_message: String(error?.message || error).slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
  } catch {
    // Não mascara o erro principal.
  }
}

export async function POST(request: NextRequest) {
  let processingRecord: any = null

  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const audioFile = formData.get('audio')
      const manualTitle = String(formData.get('title') || '').trim()

      if (!(audioFile instanceof File)) return NextResponse.json({ error: 'Escolha um arquivo de áudio.' }, { status: 400 })
      if (!isAllowedManualAudio(audioFile)) return NextResponse.json({ error: 'Envie MP3, WAV, M4A, AAC, FLAC ou OGG.' }, { status: 400 })
      if (audioFile.size > MAX_MANUAL_AUDIO_BYTES) return NextResponse.json({ error: 'Envie um áudio de até 50 MB.' }, { status: 400 })

      const arrayBuffer = await audioFile.arrayBuffer()
      const sourceHash = createHash('sha256').update(Buffer.from(arrayBuffer)).digest('hex')
      const existing = await getExistingCompleted(composer.composerId, 'manual_upload', sourceHash)
      if (existing) return NextResponse.json({ transcription: mapTranscription(existing), cached: true })

      await requireCredits(composer.composerId)
      const title = formatMusicTitle(manualTitle || audioFile.name || 'Minha transcrição')
      processingRecord = await createProcessingRecord({
        composerId: composer.composerId,
        sourceType: 'manual_upload',
        sourceHash,
        title,
        metadata: { originalFileName: audioFile.name, fileSize: audioFile.size, fileType: audioFile.type || null },
      })

      if (processingRecord.status === 'completed') return NextResponse.json({ transcription: mapTranscription(processingRecord), cached: true })

      const uploaded = await uploadManualAudioToMureka(audioFile, arrayBuffer)
      const transcription = await requestMurekaTranscription({ type: 'upload_audio_id', value: uploaded.uploadAudioId })
      const saved = await completeTranscription({
        record: processingRecord,
        composerId: composer.composerId,
        title,
        providerInputType: 'upload_audio_id',
        providerInputValue: uploaded.uploadAudioId,
        providerPayload: transcription.payload,
        zipUrl: transcription.zipUrl,
        metadata: { uploadPayload: uploaded.uploadPayload },
      })

      return NextResponse.json({ transcription: mapTranscription(saved), cached: false, credits: { cost: TRANSCRIPTION_CREDITS } })
    }

    const body = await request.json().catch(() => null)
    const studioVersionId = String(body?.studioVersionId || '').trim()
    if (!studioVersionId) return NextResponse.json({ error: 'Selecione uma música.' }, { status: 400 })

    const { data: version, error: versionError } = await supabaseAdmin
      .from('studio_versions')
      .select('*, project:studio_projects(id, title)')
      .eq('id', studioVersionId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (versionError) throw versionError
    if (!version) return NextResponse.json({ error: 'Música não encontrada.' }, { status: 404 })

    const existing = await getExistingCompleted(composer.composerId, 'studio_version', studioVersionId)
    if (existing) return NextResponse.json({ transcription: mapTranscription(existing), cached: true })

    const audio = await getStudioVersionAudioUrls(version)
    const audioUrl = audio.streamAudioUrl || audio.audioUrl
    if (!audioUrl) return NextResponse.json({ error: 'Essa música não tem áudio disponível para transcrição.' }, { status: 400 })

    await requireCredits(composer.composerId)
    const project = Array.isArray(version.project) ? version.project[0] : version.project
    const title = cleanStudioMusicTitle(project?.title || version.version_name)
    processingRecord = await createProcessingRecord({
      composerId: composer.composerId,
      sourceType: 'studio_version',
      sourceHash: studioVersionId,
      title,
      studioProjectId: version.project_id,
      studioVersionId,
      metadata: { versionName: version.version_name || null },
    })

    if (processingRecord.status === 'completed') return NextResponse.json({ transcription: mapTranscription(processingRecord), cached: true })

    const transcription = await requestMurekaTranscription({ type: 'url', value: audioUrl })
    const saved = await completeTranscription({
      record: processingRecord,
      composerId: composer.composerId,
      title,
      providerInputType: 'url',
      providerInputValue: audioUrl,
      providerPayload: transcription.payload,
      zipUrl: transcription.zipUrl,
      projectId: version.project_id,
    })

    return NextResponse.json({ transcription: mapTranscription(saved), cached: false, credits: { cost: TRANSCRIPTION_CREDITS } })
  } catch (error: any) {
    if (processingRecord?.id) await failRecord(processingRecord.id, error)
    console.error('[Music Transcription] Erro gerar transcrição:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar transcrição.' },
      { status: 500 }
    )
  }
}
