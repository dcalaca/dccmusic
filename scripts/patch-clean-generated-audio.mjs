import fs from 'node:fs'

const file = 'lib/studio-audio-backup.ts'
let source = fs.readFileSync(file, 'utf8')

if (source.includes("const CLEAN_STUDIO_AUDIO_BUCKET = 'limpo'")) {
  console.log('[patch-clean-generated-audio] já aplicado')
  process.exit(0)
}

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[patch-clean-generated-audio] trecho não encontrado: ${label}`)
  }
  source = source.replace(search, replacement)
}

replaceOnce(
  "import { supabaseAdmin } from './supabase'\n",
  "import { supabaseAdmin } from './supabase'\nimport { sanitizeGeneratedAudioMetadata } from './audio-metadata-sanitizer'\n",
  'import sanitizer'
)

replaceOnce(
  "const STUDIO_AUDIO_BUCKET = 'studio-assets'\n",
  "const STUDIO_AUDIO_BUCKET = 'studio-assets'\nconst CLEAN_STUDIO_AUDIO_BUCKET = 'limpo'\nconst CLEAN_STORAGE_PROVIDER = 'supabase-clean'\n",
  'clean bucket constants'
)

replaceOnce(
  "function isR2Configured() {\n  return Boolean(getR2Client())\n}\n",
  `function isR2Configured() {\n  return Boolean(getR2Client())\n}\n\nasync function ensureCleanStudioAudioBucket() {\n  const { data } = await supabaseAdmin.storage.getBucket(CLEAN_STUDIO_AUDIO_BUCKET)\n  if (data) return\n\n  const { error } = await supabaseAdmin.storage.createBucket(CLEAN_STUDIO_AUDIO_BUCKET, {\n    public: false,\n    fileSizeLimit: MAX_AUDIO_BYTES,\n    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],\n  })\n\n  if (error && !/already exists|duplicate/i.test(String(error.message || error))) throw error\n}\n\nasync function uploadCleanGeneratedAudio(input: { path: string; buffer: Buffer; contentType: string }) {\n  const sanitized = sanitizeGeneratedAudioMetadata(input.buffer, input.contentType)\n  await ensureCleanStudioAudioBucket()\n\n  const { error } = await supabaseAdmin.storage\n    .from(CLEAN_STUDIO_AUDIO_BUCKET)\n    .upload(input.path, sanitized.buffer, {\n      contentType: input.contentType,\n      upsert: true,\n    })\n\n  if (error) throw error\n  return {\n    path: input.path,\n    provider: CLEAN_STORAGE_PROVIDER as const,\n    contentType: input.contentType,\n    sizeBytes: sanitized.buffer.byteLength,\n    metadataSanitized: sanitized.changed,\n  }\n}\n\nfunction supabaseAudioBucketForProvider(provider?: string | null) {\n  return provider === CLEAN_STORAGE_PROVIDER ? CLEAN_STUDIO_AUDIO_BUCKET : STUDIO_AUDIO_BUCKET\n}\n`,
  'clean bucket helpers'
)

replaceOnce(
  "  const path = input.path ||\n    `${input.composerId}/${input.folder || 'uploads'}/${studioMonthKey()}/${input.fileName || `${randomUUID()}.mp3`}`\n  const r2 = getR2Client()\n\n  if (r2) {",
  "  const path = input.path ||\n    `${input.composerId}/${input.folder || 'uploads'}/${studioMonthKey()}/${input.fileName || `${randomUUID()}.mp3`}`\n\n  // Saídas musicais geradas pela DCC passam pelo bucket privado `limpo`.\n  // Uploads de referência do usuário continuam no fluxo original.\n  if (input.folder === 'audio') {\n    const clean = await uploadCleanGeneratedAudio({ path, buffer: input.buffer, contentType })\n    // Mantém o contrato TypeScript legado dos chamadores. Em runtime, o valor\n    // continua sendo `supabase-clean`, usado para rotear leitura e URL assinada.\n    return {\n      path: clean.path,\n      provider: clean.provider as 'r2' | 'supabase',\n      contentType: clean.contentType,\n      sizeBytes: clean.sizeBytes,\n    }\n  }\n\n  const r2 = getR2Client()\n\n  if (r2) {",
  'generated buffer upload'
)

replaceOnce(
  "  const extension = extensionFromContentType(downloaded.contentType, downloaded.sourceUrl)\n  const path = `${input.composerId}/audio/${studioMonthKey()}/${input.versionId}-${input.kind}.${extension}`\n  const r2 = getR2Client()\n\n  if (r2) {\n    await r2.send(new PutObjectCommand({\n      Bucket: R2_BUCKET,\n      Key: path,\n      Body: downloaded.buffer,\n      ContentType: downloaded.contentType,\n    }))\n\n    return { path, provider: 'r2', sourceUrl: downloaded.sourceUrl }\n  }\n\n  const { error } = await supabaseAdmin.storage\n    .from(STUDIO_AUDIO_BUCKET)\n    .upload(path, downloaded.buffer, {\n      contentType: downloaded.contentType,\n      upsert: true,\n    })\n\n  if (error) throw error\n  return { path, provider: 'supabase', sourceUrl: downloaded.sourceUrl }",
  "  const extension = extensionFromContentType(downloaded.contentType, downloaded.sourceUrl)\n  const path = `${input.composerId}/audio/${studioMonthKey()}/${input.versionId}-${input.kind}.${extension}`\n  const clean = await uploadCleanGeneratedAudio({\n    path,\n    buffer: downloaded.buffer,\n    contentType: downloaded.contentType,\n  })\n  return { path: clean.path, provider: clean.provider, sourceUrl: downloaded.sourceUrl }",
  'provider audio clean upload'
)

replaceOnce(
  "  const { data, error } = await supabaseAdmin.storage.from(STUDIO_AUDIO_BUCKET).download(path)",
  "  const { data, error } = await supabaseAdmin.storage.from(supabaseAudioBucketForProvider(storageProvider)).download(path)",
  'download bucket routing'
)

replaceOnce(
  "  const { data, error } = await supabaseAdmin.storage\n    .from(STUDIO_AUDIO_BUCKET)\n    .createSignedUrl(path, 60 * 60)",
  "  const { data, error } = await supabaseAdmin.storage\n    .from(supabaseAudioBucketForProvider(storageProvider))\n    .createSignedUrl(path, 60 * 60)",
  'signed URL bucket routing'
)

replaceOnce(
  "      version?.audio_storage_provider === 'r2' &&\n",
  "      (version?.audio_storage_provider === 'r2' || version?.audio_storage_provider === CLEAN_STORAGE_PROVIDER) &&\n",
  'confirmed clean backup'
)

replaceOnce(
  "        (isR2Configured() && version?.audio_storage_provider !== 'r2') ||\n",
  "        (isR2Configured() && version?.audio_storage_provider !== 'r2' && version?.audio_storage_provider !== CLEAN_STORAGE_PROVIDER) ||\n",
  'do not replace clean backup with r2'
)

fs.writeFileSync(file, source)
console.log('[patch-clean-generated-audio] aplicado com sucesso')
