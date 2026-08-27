import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase'
import { createStudioAudioSignedUrl } from '@/lib/studio-audio-backup'

const STUDIO_AUDIO_BUCKET = 'studio-assets'
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET_NAME || 'dccmusic-studio-assets'

let r2Client: S3Client | null = null

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

export type AdminPlaybackExport = {
  path: string
  provider: 'r2' | 'supabase'
  name: string
  kind: 'playback' | 'vocal' | 'other'
  pairKey: string | null
  createdAt: string | null
  sizeBytes: number | null
  url: string | null
}

function classifyExport(path: string) {
  const name = path.split('/').pop() || path
  const playback = name.match(/^(.*)-playback-[a-z0-9]{8}\.mp3$/i)
  if (playback) return { kind: 'playback' as const, pairKey: playback[1].toLowerCase() }
  const vocal = name.match(/^(.*)-(?:voz|vocal)-[a-z0-9]{8}\.mp3$/i)
  if (vocal) return { kind: 'vocal' as const, pairKey: vocal[1].toLowerCase() }
  return { kind: 'other' as const, pairKey: null }
}

async function listR2Exports(composerId: string): Promise<AdminPlaybackExport[]> {
  const r2 = getR2Client()
  if (!r2) return []
  const prefix = `${composerId}/exports/`
  const rows: AdminPlaybackExport[] = []
  let continuationToken: string | undefined

  do {
    const result = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }))
    for (const object of result.Contents || []) {
      if (!object.Key) continue
      const info = classifyExport(object.Key)
      rows.push({
        path: object.Key,
        provider: 'r2',
        name: object.Key.split('/').pop() || object.Key,
        kind: info.kind,
        pairKey: info.pairKey,
        createdAt: object.LastModified?.toISOString() || null,
        sizeBytes: typeof object.Size === 'number' ? object.Size : null,
        url: null,
      })
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (continuationToken)

  return rows
}

async function listSupabaseExports(composerId: string): Promise<AdminPlaybackExport[]> {
  const base = `${composerId}/exports`
  const { data: months, error: monthsError } = await supabaseAdmin.storage.from(STUDIO_AUDIO_BUCKET).list(base, {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  })
  if (monthsError) return []

  const rows: AdminPlaybackExport[] = []
  for (const month of months || []) {
    if (!month?.name) continue
    const monthPath = `${base}/${month.name}`
    const { data: files, error } = await supabaseAdmin.storage.from(STUDIO_AUDIO_BUCKET).list(monthPath, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) continue
    for (const file of files || []) {
      if (!file?.name) continue
      const path = `${monthPath}/${file.name}`
      const info = classifyExport(path)
      rows.push({
        path,
        provider: 'supabase',
        name: file.name,
        kind: info.kind,
        pairKey: info.pairKey,
        createdAt: (file as any).created_at || (file as any).updated_at || null,
        sizeBytes: Number((file as any).metadata?.size || 0) || null,
        url: null,
      })
    }
  }
  return rows
}

export async function listComposerPlaybackExports(composerId: string) {
  const r2Rows = await listR2Exports(composerId).catch((error) => {
    console.error('[Admin Playback] Erro ao listar R2:', error)
    return [] as AdminPlaybackExport[]
  })
  const rows = r2Rows.length > 0
    ? r2Rows
    : await listSupabaseExports(composerId).catch((error) => {
        console.error('[Admin Playback] Erro ao listar Supabase Storage:', error)
        return [] as AdminPlaybackExport[]
      })

  const withUrls = await Promise.all(rows.map(async (row) => ({
    ...row,
    url: await createStudioAudioSignedUrl(row.path, row.provider).catch(() => null),
  })))

  return withUrls.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function normalizeTitle(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'musica'
}

export async function recoverLegacyPlaybackAssets(composerId: string) {
  const exports = await listComposerPlaybackExports(composerId)
  const playbacks = exports.filter((row) => row.kind === 'playback' && row.pairKey)
  const vocals = exports.filter((row) => row.kind === 'vocal' && row.pairKey)
  if (playbacks.length === 0 || vocals.length === 0) return { recovered: 0 }

  const [{ data: charges, error: chargesError }, { data: assets, error: assetsError }, { data: projects, error: projectsError }] = await Promise.all([
    supabaseAdmin
      .from('studio_credit_transactions')
      .select('id, project_id, metadata, created_at')
      .eq('composer_id', composerId)
      .eq('action', 'stem_separation')
      .not('project_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('studio_credit_transactions')
      .select('id, project_id, metadata, created_at')
      .eq('composer_id', composerId)
      .eq('action', 'stem_separation_asset')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('studio_projects')
      .select('id, title')
      .eq('composer_id', composerId),
  ])
  if (chargesError) throw chargesError
  if (assetsError) throw assetsError
  if (projectsError) throw projectsError

  const projectTitles = new Map((projects || []).map((project: any) => [project.id, normalizeTitle(project.title)]))
  const existingRequestIds = new Set((assets || []).map((asset: any) => String(asset?.metadata?.requestId || '')).filter(Boolean))
  const existingVersionIds = new Set((assets || []).map((asset: any) => String(asset?.metadata?.versionId || '')).filter(Boolean))
  const usedPaths = new Set<string>()
  for (const asset of assets || []) {
    if (asset?.metadata?.playbackPath) usedPaths.add(String(asset.metadata.playbackPath))
    if (asset?.metadata?.vocalPath) usedPaths.add(String(asset.metadata.vocalPath))
  }

  let recovered = 0
  for (const playback of playbacks) {
    if (usedPaths.has(playback.path) || !playback.pairKey) continue
    const candidates = vocals
      .filter((voice) => voice.pairKey === playback.pairKey && !usedPaths.has(voice.path))
      .sort((a, b) => Math.abs(new Date(a.createdAt || 0).getTime() - new Date(playback.createdAt || 0).getTime()) - Math.abs(new Date(b.createdAt || 0).getTime() - new Date(playback.createdAt || 0).getTime()))
    const vocal = candidates[0]
    if (!vocal) continue
    const pairTimeDelta = Math.abs(new Date(vocal.createdAt || 0).getTime() - new Date(playback.createdAt || 0).getTime())
    if (!Number.isFinite(pairTimeDelta) || pairTimeDelta > 5 * 60 * 1000) continue

    const pairTime = Math.max(new Date(playback.createdAt || 0).getTime(), new Date(vocal.createdAt || 0).getTime())
    const matchingCharges = (charges || [])
      .filter((charge: any) => {
        const requestId = String(charge?.metadata?.requestId || '')
        const versionId = String(charge?.metadata?.versionId || '')
        if (!requestId || !versionId || existingRequestIds.has(requestId) || existingVersionIds.has(versionId)) return false
        if (projectTitles.get(charge.project_id) !== playback.pairKey) return false
        const delta = Math.abs(new Date(charge.created_at || 0).getTime() - pairTime)
        return Number.isFinite(delta) && delta <= 30 * 60 * 1000
      })
      .sort((a: any, b: any) => Math.abs(new Date(a.created_at).getTime() - pairTime) - Math.abs(new Date(b.created_at).getTime() - pairTime))

    if (matchingCharges.length !== 1) continue
    const charge: any = matchingCharges[0]
    const requestId = String(charge.metadata.requestId)
    const versionId = String(charge.metadata.versionId)

    const { error } = await supabaseAdmin.from('studio_credit_transactions').insert({
      composer_id: composerId,
      project_id: charge.project_id,
      action: 'stem_separation_asset',
      amount: 0,
      description: 'Playback e voz isolada recuperados do storage',
      metadata: {
        requestId,
        versionId,
        feature: 'playback',
        playbackPath: playback.path,
        playbackProvider: playback.provider,
        vocalPath: vocal.path,
        vocalProvider: vocal.provider,
        separationProvider: 'legacy-recovered',
        recoveredAt: new Date().toISOString(),
      },
    })
    if (error) {
      console.error('[Admin Playback] Falha ao recuperar par legado:', error)
      continue
    }

    existingRequestIds.add(requestId)
    existingVersionIds.add(versionId)
    usedPaths.add(playback.path)
    usedPaths.add(vocal.path)
    recovered += 1
  }

  return { recovered }
}

export async function getComposerSavedPlaybackAssets(composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, project_id, metadata, created_at')
    .eq('composer_id', composerId)
    .eq('action', 'stem_separation_asset')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error

  const projectIds = [...new Set((data || []).map((row: any) => row.project_id).filter(Boolean))]
  const versionIds = [...new Set((data || []).map((row: any) => row?.metadata?.versionId).filter(Boolean))]

  const [{ data: projects }, { data: versions }] = await Promise.all([
    projectIds.length ? supabaseAdmin.from('studio_projects').select('id, title').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
    versionIds.length ? supabaseAdmin.from('studio_versions').select('id, version_name').in('id', versionIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const projectById = new Map((projects || []).map((row: any) => [row.id, row]))
  const versionById = new Map((versions || []).map((row: any) => [row.id, row]))

  return Promise.all((data || []).map(async (row: any) => {
    const metadata = row.metadata || {}
    const version = versionById.get(metadata.versionId)
    return {
      id: row.id,
      projectId: row.project_id,
      projectTitle: projectById.get(row.project_id)?.title || 'Projeto',
      versionId: metadata.versionId || null,
      versionName: version?.version_name || null,
      createdAt: row.created_at || null,
      separationProvider: metadata.separationProvider || null,
      recovered: metadata.separationProvider === 'legacy-recovered',
      playbackPath: metadata.playbackPath || null,
      vocalPath: metadata.vocalPath || null,
      playbackUrl: await createStudioAudioSignedUrl(metadata.playbackPath, metadata.playbackProvider).catch(() => null),
      vocalUrl: await createStudioAudioSignedUrl(metadata.vocalPath, metadata.vocalProvider || metadata.playbackProvider).catch(() => null),
    }
  }))
}
