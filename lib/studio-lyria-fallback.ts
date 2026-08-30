import crypto from 'crypto'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { uploadStudioAudioBuffer } from '@/lib/studio-audio-backup'

const MODEL = process.env.GOOGLE_LYRIA_MODEL || 'lyria-3-pro-preview'
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dccmusic'
const MAX_DURATION_SECONDS = 184

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

async function getGoogleAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado.')

  let account: { client_email?: string; private_key?: string; token_uri?: string }
  try { account = JSON.parse(raw) } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválido.') }
  if (!account.client_email || !account.private_key) throw new Error('Service account do Google incompleta.')

  const now = Math.floor(Date.now() / 1000)
  const tokenUri = account.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const assertion = `${unsigned}.${base64url(signer.sign(account.private_key))}`

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.access_token) throw new Error(`Falha ao autenticar no Google: ${result?.error_description || result?.error || response.status}`)
  return String(result.access_token)
}

function sanitizeLyrics(value: string) {
  return value.split(/\r?\n/)
    .map((line) => line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*|__/g, ''))
    .filter((line) => !/^(?:t[ií]tulo|title|artista|artist|g[eê]nero|genre|estilo|style|bpm|dura[cç][aã]o|duration)\s*:/i.test(line))
    .map((line) => {
      const plain = line.replace(/^\((.+)\)$/, '$1').replace(/\s*[:;]+\s*$/, '')
      return /^(?:verso|verse|estrofe|pr[eé][ -]?refr[aã]o|refr[aã]o|chorus|estribillo|ponte|bridge|introdu[cç][aã]o|intro|final|outro)(?:\s+[\divx]+)?$/i.test(plain) ? `[${plain}]` : line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function timestamp(seconds: number) {
  const value = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function lyricWeight(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length
  const syllables = (text.toLocaleLowerCase('pt-BR').match(/[aeiouáéíóúâêôãõàü]+/g) || []).length
  return Math.max(1, syllables + words * 0.35)
}

/** A direção temporal é calculada pela DCC; o Lyria só interpreta a partitura. */
function buildDccTimedLyrics(lyrics: string, bpm: number) {
  const entries = sanitizeLyrics(lyrics).split(/\r?\n/).map((text) => text.trim()).filter(Boolean)
  const lines = entries.filter((entry) => !/^\[[^\]]+]$/.test(entry))
  if (!lines.length) throw new Error('A letra não contém frases cantáveis para o fallback.')

  const secondsPerBeat = 60 / bpm
  const estimated = lines.reduce((sum, line) => sum + lyricWeight(line) / ((bpm / 60) * 1.65) + secondsPerBeat * .5, 0) + secondsPerBeat * 16
  if (estimated > MAX_DURATION_SECONDS) throw new Error('A letra excede o limite de duração do fallback musical.')

  const duration = Math.max(120, Math.min(MAX_DURATION_SECONDS, Math.ceil(estimated / 5) * 5))
  const intro = secondsPerBeat * 8
  const outro = secondsPerBeat * 8
  const transitions = Math.max(0, entries.filter((entry) => /^\[[^\]]+]$/.test(entry)).length - 1) * secondsPerBeat * 2
  const available = duration - intro - outro - transitions
  const totalWeight = lines.reduce((sum, line) => sum + lyricWeight(line), 0)
  let cursor = intro
  let sawSection = false
  const plan = [`[00:00-${timestamp(intro)}] Instrumental intro. No vocals.`]

  for (const entry of entries) {
    if (/^\[[^\]]+]$/.test(entry)) {
      if (sawSection) {
        const end = cursor + secondsPerBeat * 2
        plan.push(`[${timestamp(cursor)}-${timestamp(end)}] Short instrumental breath. No vocals.`)
        cursor = end
      }
      plan.push(entry)
      sawSection = true
      continue
    }
    const end = Math.min(duration - outro, cursor + available * lyricWeight(entry) / totalWeight)
    plan.push(`[${timestamp(cursor)}-${timestamp(end)}] ${entry}`)
    cursor = end
  }
  plan.push(`[${timestamp(Math.max(cursor, duration - outro))}-${timestamp(duration)}] Instrumental outro. No new lyrics. End naturally.`)
  return { plan: plan.join('\n'), duration }
}

function extractAudio(response: any) {
  const outputs = Array.isArray(response?.outputs) ? response.outputs : []
  const audio = outputs.find((item: any) => item?.type === 'audio' && item?.data)
  if (!audio?.data) throw new Error('O Google não retornou áudio no fallback.')
  return { buffer: Buffer.from(audio.data, 'base64'), contentType: audio.mime_type || 'audio/mpeg' }
}

async function generateLyriaVersion(input: { accessToken: string; prompt: string }) {
  const response = await fetch(`https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/global/interactions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ model: MODEL, input: [{ type: 'text', text: input.prompt }] }),
    cache: 'no-store',
  })
  const raw = await response.text()
  let result: any = null
  try { result = JSON.parse(raw) } catch { /* kept below for useful error */ }
  if (!response.ok) throw new Error(`Google Lyria recusou a geração (${response.status}): ${result?.error?.message || raw.slice(0, 500)}`)
  return { ...extractAudio(result), response: result }
}

export async function startLyriaFallbackForSunoGeneration(input: {
  generation: any
  sunoFailurePayload?: any
  reason: 'callback_failure' | 'poll_failure' | 'timeout'
}) {
  const { generation, sunoFailurePayload, reason } = input
  if (generation?.provider !== 'sunoapi') return { started: false as const, reason: 'not_suno' }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return { started: false as const, reason: 'lyria_not_configured' }

  try {
    const request = generation.request_payload || {}
    const lyrics = String(request.prompt || request.lyrics || '').trim()
    if (!lyrics) return { started: false as const, reason: 'missing_lyrics' }
    const bpm = Math.min(120, Math.max(90, Number(request.bpm) || 100))
    const timed = buildDccTimedLyrics(lyrics, bpm)
    const style = String(request.style || 'original, polished song').slice(0, 1600)
    const title = String(request.title || 'Sua música').slice(0, 100)
    const common = [
      `Create one complete original song titled "${title}".`,
      `Musical direction: ${style}`,
      `MANDATORY FIXED TEMPO: ${bpm} BPM.`,
      `Target total duration: approximately ${timed.duration} seconds.`,
      'Use the DCC timed lyrics plan exactly. Every bracketed section name is silent structural guidance and must never be sung. Do not omit, add, reorder, repeat, rush, or speak lyrics. Preserve natural Brazilian Portuguese pronunciation and breathing room.',
      'TIMED LYRICS PLAN:', timed.plan,
    ].join('\n\n')
    const accessToken = await getGoogleAccessToken()
    const versions = await Promise.all([
      generateLyriaVersion({ accessToken, prompt: `${common}\n\nVERSION A: intimate opening, expressive vocal interpretation and a distinct arrangement.` }),
      generateLyriaVersion({ accessToken, prompt: `${common}\n\nVERSION B: create a clearly different intro, groove, arrangement and vocal interpretation while keeping the same lyrics and genre.` }),
    ])

    const now = new Date().toISOString()
    const uploaded = await Promise.all(versions.map((version, index) => uploadStudioAudioBuffer({
      composerId: generation.composer_id,
      folder: 'audio',
      fileName: `${generation.id}-lyria-${index + 1}-${randomUUID()}.mp3`,
      buffer: version.buffer,
      contentType: version.contentType,
    })))

    await supabaseAdmin.from('studio_versions').update({ is_current: false, updated_at: now })
      .eq('project_id', generation.project_id).eq('composer_id', generation.composer_id)
    const { error: versionError } = await supabaseAdmin.from('studio_versions').insert(uploaded.map((file, index) => ({
      project_id: generation.project_id,
      composer_id: generation.composer_id,
      generation_id: generation.id,
      version_name: `Música gerada #${index + 1}`,
      style,
      duration: timed.duration,
      model: MODEL,
      provider_payload: { provider: 'lyria', version: index + 1, timingPlan: timed.plan },
      audio_path: file.path,
      stream_audio_path: file.path,
      audio_storage_provider: file.provider,
      stream_audio_storage_provider: file.provider,
      audio_backup_status: 'backed_up',
      is_current: index === uploaded.length - 1,
    })))
    if (versionError) throw versionError

    const fallbackLog = { from: 'sunoapi', to: 'lyria', reason, startedAt: now, sunoFailure: sunoFailurePayload || generation.response_payload || null }
    await Promise.all([
      supabaseAdmin.from('studio_generations').update({
        provider: 'lyria', status: 'completed', provider_task_id: `lyria-${generation.id}`,
        error_message: null,
        request_payload: { ...request, providerAttemptLog: { ...(request.providerAttemptLog || {}), asyncFallback: fallbackLog, fallbackUsed: true } },
        response_payload: { provider: 'lyria', model: MODEL, versionCount: uploaded.length, timingPlan: timed.plan, asyncFallback: fallbackLog },
        updated_at: now,
      }).eq('id', generation.id).eq('provider', 'sunoapi'),
      supabaseAdmin.from('studio_projects').update({ status: 'ready', updated_at: now }).eq('id', generation.project_id),
    ])
    console.info('[Studio IA] Fallback Lyria concluído', { generationId: generation.id, reason, versions: uploaded.length })
    return { started: true as const, taskId: `lyria-${generation.id}` }
  } catch (error: any) {
    console.error('[Studio IA] Falha ao iniciar fallback Lyria:', error)
    return { started: false as const, reason: 'fallback_exception', error: error?.message || String(error) }
  }
}
