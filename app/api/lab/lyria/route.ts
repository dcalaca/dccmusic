import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { buildLyriaTimedLyrics, estimateLyriaSongDuration, LYRIA_MAX_DURATION_SECONDS, sanitizeLyriaLyrics } from '@/lib/lyria-timing'
import { buildLyriaCreativeDirection, buildLyriaLyricPrompt, normalizeLyriaStudioSettings } from '@/lib/lyria-studio'

export const runtime = 'nodejs'
export const maxDuration = 300
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dccmusic'
const MODEL = process.env.GOOGLE_LYRIA_MODEL || 'lyria-3-pro-preview'

function base64url(value: string | Buffer) { return Buffer.from(value).toString('base64url') }

async function getServiceAccountAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado.')
  let sa: { client_email?: string; private_key?: string; token_uri?: string }
  try { sa = JSON.parse(raw) } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não contém um JSON válido.') }
  if (!sa.client_email || !sa.private_key) throw new Error('Service account JSON sem client_email ou private_key.')
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: tokenUri, iat: now, exp: now + 3600 }))
  const unsigned = `${header}.${payload}`
  const signer = crypto.createSign('RSA-SHA256'); signer.update(unsigned); signer.end()
  const assertion = `${unsigned}.${base64url(signer.sign(sa.private_key))}`
  const r = await fetch(tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), cache: 'no-store' })
  const d = await r.json()
  if (!r.ok || !d?.access_token) throw new Error(`Falha ao obter OAuth token do Google: ${d?.error_description || d?.error || r.status}`)
  return d.access_token as string
}

async function generateStudioLyric(prompt: string, songLanguage: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada para criar a letra do laboratório.')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', temperature: 0.85, messages: [
      { role: 'system', content: `Você é compositor profissional. Escreva exclusivamente no idioma ${songLanguage}, com identidade cultural autêntica e frases realmente cantáveis.` },
      { role: 'user', content: prompt },
    ] }), cache: 'no-store',
  })
  const data = await response.json()
  const lyric = data?.choices?.[0]?.message?.content?.trim()
  if (!response.ok || !lyric) throw new Error(data?.error?.message || 'A IA não conseguiu criar uma letra válida para a música.')
  return String(lyric)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bpm = '100', naturalProsody = true } = body
    const settings = normalizeLyriaStudioSettings(body)
    const ownLyrics = typeof body.lyrics === 'string' ? sanitizeLyriaLyrics(body.lyrics.slice(0, 12000), settings.title) : ''
    const legacyPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!settings.title && !legacyPrompt) return NextResponse.json({ error: 'Informe o nome da música.' }, { status: 400 })
    if (!ownLyrics && !settings.idea && !legacyPrompt) return NextResponse.json({ error: 'Descreva sua ideia ou cole a letra completa.' }, { status: 400 })
    const bpmValue = Number(bpm)
    if (![90, 100, 110, 120].includes(bpmValue)) return NextResponse.json({ error: 'Escolha um BPM válido.' }, { status: 400 })
    const lyricTargetSeconds = settings.lineCount === 'curta' ? 120 : settings.lineCount === 'longa' ? 180 : 150
    const generatedLyric = !ownLyrics && settings.idea ? await generateStudioLyric(buildLyriaLyricPrompt(settings, lyricTargetSeconds), settings.songLanguage) : ''
    const lyrics = sanitizeLyriaLyrics(ownLyrics || generatedLyric, settings.title)
    const timing = estimateLyriaSongDuration(lyrics, bpmValue)
    if (timing.exceedsModelLimit) {
      const requiredMinutes = Math.floor(timing.naturalDurationSeconds / 60)
      const requiredSeconds = String(timing.naturalDurationSeconds % 60).padStart(2, '0')
      return NextResponse.json({
        error: `Essa letra precisaria de aproximadamente ${requiredMinutes}:${requiredSeconds} para ser cantada naturalmente. O Google Lyria aceita no máximo 3:04 por música.`,
        requiredDuration: timing.naturalDurationSeconds,
        maximumDuration: LYRIA_MAX_DURATION_SECONDS,
      }, { status: 422 })
    }
    const durationValue = timing.durationSeconds
    const creativeDirection = legacyPrompt || buildLyriaCreativeDirection(settings)
    const accessToken = await getServiceAccountAccessToken()

    const controls = [
      `MANDATORY FIXED TEMPO: ${bpmValue} BPM. Never choose or drift to an automatic tempo.`,
      `Target total duration: approximately ${durationValue} seconds.`,
      naturalProsody && lyrics?.trim() ? `VOCAL PROSODY PRIORITY: Adapt the vocal melody and phrasing dynamically to the natural prosody, stresses, pauses, and syllable count of every lyric line. Never rush, cram, compress, speed-read, or unnaturally accelerate words to preserve a fixed melody. For longer lyric lines, extend the melodic phrase, use additional measures, vary note durations, add natural pickups or rests, or change the melodic contour. Shorter and longer lines do not need identical melodic shapes or identical bar counts. Preserve a coherent song and groove, but let the vocal melody follow the lyric. Prioritize clear, natural Brazilian Portuguese pronunciation, breathing room, intelligibility, and expressive singing over rigid melodic repetition.` : '',
    ].filter(Boolean).join('\n')

    const timedLyrics = lyrics?.trim() ? buildLyriaTimedLyrics(lyrics.trim(), bpmValue, durationValue) : ''
    const text = lyrics?.trim()
      ? `${creativeDirection}\n\n${controls}\n\nTIMED LYRICS PLAN: Sing every lyric line only inside its assigned time interval. Longer phrases intentionally receive more time. Respect instrumental gaps, breathing room, section boundaries and the exact fixed BPM. Use the provided words exactly: do not rewrite, omit, duplicate, reorder or add lyrics. Preserve the pronunciation of the selected language.\n\n${timedLyrics}`
      : `${creativeDirection}\n\n${controls}`

    const response = await fetch(`https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/global/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ model: MODEL, input: [{ type: 'text', text }] }), cache: 'no-store',
    })
    const raw = await response.text(); let data: any
    try { data = JSON.parse(raw) } catch { data = null }
    if (!response.ok) return NextResponse.json({ error: `Google Lyria respondeu HTTP ${response.status}.`, details: data?.error?.message || raw || 'Resposta sem detalhes.' }, { status: response.status })
    const outputs = Array.isArray(data?.outputs) ? data.outputs : []
    const audio = outputs.find((o: any) => o?.type === 'audio' && o?.data)
    const texts = outputs.filter((o: any) => o?.type === 'text' && o?.text).map((o: any) => o.text)
    if (!audio?.data) return NextResponse.json({ error: 'O Lyria respondeu, mas não encontrei áudio na resposta.', details: JSON.stringify(data, null, 2).slice(0, 8000) }, { status: 502 })
    return NextResponse.json({ audio: `data:${audio.mime_type || 'audio/mpeg'};base64,${audio.data}`, lyrics: lyrics || texts[0] || '', description: texts[1] || '', timingPlan: timedLyrics, creativeDirection, generatedLyrics: !ownLyrics && Boolean(lyrics), duration: durationValue, phraseCount: timing.phraseCount, model: data?.model || MODEL })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno no laboratório do Lyria.', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
