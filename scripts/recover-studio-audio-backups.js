/**
 * Recupera backups failed (prioridade: 404) via CDN Suno / record-info.
 * node scripts/recover-studio-audio-backups.js
 * node scripts/recover-studio-audio-backups.js --limit=200 --only=404
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { PutObjectCommand, HeadObjectCommand, S3Client } = require('@aws-sdk/client-s3')

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=')
    return [k, v === undefined ? true : v]
  })
)
const LIMIT = Number(args.limit || 300)
const DRY_RUN = Boolean(args['dry-run'])
const ONLY = String(args.only || '404') // 404 | all | terminated
const DELAY_MS = Number(args.delay || 250)

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sunoKey = process.env.SUNOAPI_KEY
const bucket = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET_NAME || 'dccmusic-studio-assets'
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

if (!sunoKey) throw new Error('SUNOAPI_KEY ausente')
if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('Credenciais R2 ausentes')

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const monthKey = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

async function urlAlive(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1', Accept: '*/*' },
    })
    return response.ok || response.status === 206
  } catch {
    return false
  }
}

async function download(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
  })
  if (!response.ok) throw new Error(`download ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length) throw new Error('download vazio')
  return { buffer, contentType: response.headers.get('content-type') || 'audio/mpeg' }
}

async function fetchSunoTracks(taskId) {
  const response = await fetch(
    `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${sunoKey}` } }
  )
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.code !== 200) {
    throw new Error(`suno ${response.status} ${json?.msg || ''}`.trim())
  }
  return json?.data?.response?.sunoData || json?.data?.sunoData || []
}

function pickSourceUrl(track) {
  if (!track) return null
  if (track.id) return `https://cdn1.suno.ai/${track.id}.mp3`
  return track.sourceAudioUrl || track.audioUrl || track.sourceStreamAudioUrl || track.streamAudioUrl || null
}

function extractAudioId(version) {
  const payload = version.provider_payload || {}
  return (
    payload.id ||
    payload.audio_id ||
    payload.audioId ||
    payload?.data?.id ||
    null
  )
}

async function loadCandidates() {
  let query = sb
    .from('studio_versions')
    .select(
      'id, project_id, composer_id, generation_id, created_at, audio_url, stream_audio_url, audio_backup_status, audio_backup_error, provider_payload'
    )
    .eq('audio_backup_status', 'failed')
    .order('created_at', { ascending: true })
    .limit(LIMIT)

  if (ONLY === '404') {
    query = query.eq('audio_backup_error', 'Falha ao baixar áudio externo (404)')
  } else if (ONLY === 'terminated') {
    query = query.eq('audio_backup_error', 'terminated')
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function resolveTaskAndTracks(version, cache) {
  let taskId = null
  let generationPayload = null

  if (version.generation_id) {
    const { data } = await sb
      .from('studio_generations')
      .select('provider_task_id, response_payload')
      .eq('id', version.generation_id)
      .maybeSingle()
    taskId = data?.provider_task_id || null
    generationPayload = data?.response_payload || null
  }

  if (!taskId) {
    const { data: gens } = await sb
      .from('studio_generations')
      .select('provider_task_id, response_payload')
      .eq('project_id', version.project_id)
      .not('provider_task_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)
    taskId = gens?.[0]?.provider_task_id || null
    generationPayload = gens?.[0]?.response_payload || generationPayload
  }

  // tracks from stored payload
  const fromPayload =
    generationPayload?.data?.response?.sunoData ||
    generationPayload?.response?.sunoData ||
    generationPayload?.data?.data ||
    generationPayload?.data?.sunoData ||
    []

  if (!taskId) return { taskId: null, tracks: Array.isArray(fromPayload) ? fromPayload : [] }

  if (!cache.has(taskId)) {
    try {
      const apiTracks = await fetchSunoTracks(taskId)
      cache.set(taskId, Array.isArray(apiTracks) ? apiTracks : [])
    } catch (error) {
      cache.set(taskId, { error: String(error.message || error) })
    }
    await sleep(DELAY_MS)
  }

  const cached = cache.get(taskId)
  if (cached?.error) {
    return { taskId, tracks: Array.isArray(fromPayload) ? fromPayload : [], error: cached.error }
  }
  return {
    taskId,
    tracks: (Array.isArray(cached) && cached.length ? cached : null) || (Array.isArray(fromPayload) ? fromPayload : []),
  }
}

function matchTrack(version, tracks) {
  const audioId = extractAudioId(version)
  if (audioId) {
    const byId = tracks.find((track) => track.id === audioId)
    if (byId) return byId
  }

  const urls = [version.audio_url, version.stream_audio_url].filter(Boolean)
  for (const track of tracks) {
    const trackUrls = [track.audioUrl, track.sourceAudioUrl, track.streamAudioUrl, track.sourceStreamAudioUrl, track.id && `https://cdn1.suno.ai/${track.id}.mp3`]
    if (urls.some((url) => trackUrls.includes(url))) return track
  }

  return null
}

async function uploadAndMark(version, sourceUrl) {
  if (DRY_RUN) return { dryRun: true, sourceUrl }

  const { buffer, contentType } = await download(sourceUrl)
  const path = `${version.composer_id}/audio/${monthKey()}/${version.id}-audio.mp3`

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    })
  )

  const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: path }))
  if (!head.ContentLength) throw new Error('r2 vazio')

  const { error } = await sb
    .from('studio_versions')
    .update({
      audio_url: sourceUrl,
      audio_path: path,
      stream_audio_path: path,
      audio_storage_provider: 'r2',
      stream_audio_storage_provider: 'r2',
      audio_backup_status: 'backed_up',
      audio_backup_error: null,
      audio_backed_up_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', version.id)

  if (error) throw error
  return { path, bytes: buffer.length, sourceUrl }
}

async function main() {
  const candidates = await loadCandidates()
  console.log(JSON.stringify({ dryRun: DRY_RUN, only: ONLY, candidates: candidates.length }))

  const cache = new Map()
  const summary = { recovered: 0, failed: 0, details: [] }

  // group by generation for index fallback
  const byGeneration = new Map()
  for (const version of candidates) {
    const key = version.generation_id || version.id
    if (!byGeneration.has(key)) byGeneration.set(key, [])
    byGeneration.get(key).push(version)
  }
  for (const group of byGeneration.values()) {
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }

  for (const version of candidates) {
    try {
      // 1) direct id from provider_payload
      const audioId = extractAudioId(version)
      let sourceUrl = audioId ? `https://cdn1.suno.ai/${audioId}.mp3` : null
      if (sourceUrl && !(await urlAlive(sourceUrl))) sourceUrl = null

      // 2) suno API / payload tracks
      if (!sourceUrl) {
        const { tracks, error } = await resolveTaskAndTracks(version, cache)
        if (error && !tracks.length) {
          summary.failed += 1
          summary.details.push({ id: version.id, reason: error, created: version.created_at })
          console.log('FAIL', version.id, error)
          continue
        }

        let track = matchTrack(version, tracks)
        if (!track && version.generation_id) {
          const siblings = byGeneration.get(version.generation_id) || [version]
          const index = siblings.findIndex((item) => item.id === version.id)
          track = tracks[index] || null
        }

        sourceUrl = pickSourceUrl(track)
        if (sourceUrl && !(await urlAlive(sourceUrl))) {
          summary.failed += 1
          summary.details.push({ id: version.id, reason: 'cdn_morto', created: version.created_at })
          console.log('FAIL', version.id, 'cdn_morto')
          continue
        }
      }

      if (!sourceUrl) {
        summary.failed += 1
        summary.details.push({ id: version.id, reason: 'sem_url', created: version.created_at })
        console.log('FAIL', version.id, 'sem_url')
        continue
      }

      const result = await uploadAndMark(version, sourceUrl)
      summary.recovered += 1
      summary.details.push({ id: version.id, status: 'recovered', ...result })
      console.log('OK', version.id, result.bytes || '', result.sourceUrl || sourceUrl)
    } catch (error) {
      summary.failed += 1
      summary.details.push({ id: version.id, reason: String(error.message || error), created: version.created_at })
      console.log('ERR', version.id, error.message || error)
    }
  }

  console.log('\n=== RESUMO ===')
  console.log(
    JSON.stringify(
      {
        recovered: summary.recovered,
        failed: summary.failed,
        failedSample: summary.details.filter((d) => !d.status).slice(0, 40),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
