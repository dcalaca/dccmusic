import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET_NAME = 'studio-assets'

export type SavedTranscriptionFiles = {
  zipPath: string
  pdfPath: string
  musicXmlPath: string
  storageProvider: 'supabase'
  pdfFileName: string
  musicXmlFileName: string
  zipFileName: string
}

function normalizeFileName(value: string, fallback: string) {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return cleaned || fallback
}

async function ensureStudioAssetsBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) return
  if (buckets?.some((bucket) => bucket.id === BUCKET_NAME)) return

  await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: 100 * 1024 * 1024,
  })
}

async function uploadBuffer(path: string, buffer: Buffer, contentType: string) {
  await ensureStudioAssetsBucket()
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error
}

export async function createTranscriptionSignedUrl(path?: string | null) {
  if (!path) return null

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60)

  if (error) {
    console.error('[Music Transcription] Erro ao assinar arquivo:', error)
    return null
  }

  return data?.signedUrl || null
}

export async function saveMurekaTranscriptionZip(input: {
  composerId: string
  transcriptionId: string
  title: string
  zipUrl: string
}): Promise<SavedTranscriptionFiles> {
  const response = await fetch(input.zipUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Não consegui baixar o ZIP da Mureka para salvar internamente.')
  }

  const zipBuffer = Buffer.from(await response.arrayBuffer())
  const zip = await JSZip.loadAsync(zipBuffer)
  const pdfEntry = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.pdf'))
  const musicXmlEntry = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.musicxml'))

  if (!pdfEntry) throw new Error('O ZIP da Mureka não contém PDF.')
  if (!musicXmlEntry) throw new Error('O ZIP da Mureka não contém MusicXML.')

  const baseName = normalizeFileName(input.title, 'transcricao')
  const basePath = `${input.composerId}/music-transcriptions/${input.transcriptionId}`
  const pdfPath = `${basePath}/${baseName}.pdf`
  const musicXmlPath = `${basePath}/${baseName}.musicxml`
  const zipPath = `${basePath}/${baseName}-${randomUUID()}.zip`

  const [pdfBuffer, musicXmlBuffer] = await Promise.all([
    pdfEntry.async('nodebuffer'),
    musicXmlEntry.async('nodebuffer'),
  ])

  await Promise.all([
    uploadBuffer(zipPath, zipBuffer, 'application/zip'),
    uploadBuffer(pdfPath, pdfBuffer, 'application/pdf'),
    uploadBuffer(musicXmlPath, musicXmlBuffer, 'application/vnd.recordare.musicxml+xml'),
  ])

  return {
    zipPath,
    pdfPath,
    musicXmlPath,
    storageProvider: 'supabase',
    pdfFileName: `${baseName}.pdf`,
    musicXmlFileName: `${baseName}.musicxml`,
    zipFileName: `${baseName}.zip`,
  }
}

export async function readTranscriptionTextFile(path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(path)

  if (error) throw error
  return data.text()
}

export async function readTranscriptionBinaryFile(path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(path)

  if (error) throw error
  return Buffer.from(await data.arrayBuffer())
}
