import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dccmusic'
const MODEL = process.env.GOOGLE_LYRIA_MODEL || 'lyria-3-pro-preview'

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

async function getServiceAccountAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado.')

  let serviceAccount: { client_email?: string; private_key?: string; token_uri?: string }
  try {
    serviceAccount = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não contém um JSON válido.')
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON sem client_email ou private_key.')
  }

  const now = Math.floor(Date.now() / 1000)
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(serviceAccount.private_key)
  const assertion = `${unsigned}.${base64url(signature)}`

  const tokenResponse = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  })

  const tokenData = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(`Falha ao obter OAuth token do Google: ${tokenData?.error_description || tokenData?.error || tokenResponse.status}`)
  }
  return tokenData.access_token as string
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, lyrics } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Informe uma descrição para a música.' }, { status: 400 })
    }

    const accessToken = await getServiceAccountAccessToken()

    const text = lyrics?.trim()
      ? `${prompt.trim()}\n\nUse the following user-provided lyrics exactly as the song lyrics, preserving sections and language:\n${lyrics.trim()}`
      : prompt.trim()

    const response = await fetch(
      `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/global/interactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: [{ type: 'text', text }],
        }),
        cache: 'no-store',
      }
    )

    const rawResponse = await response.text()
    let data: any
    try { data = JSON.parse(rawResponse) } catch { data = null }

    if (!response.ok) {
      return NextResponse.json({
        error: `Google Lyria respondeu HTTP ${response.status}.`,
        details: data?.error?.message || rawResponse || 'Resposta sem detalhes.',
      }, { status: response.status })
    }

    const outputs = Array.isArray(data?.outputs) ? data.outputs : []
    const audio = outputs.find((o: any) => o?.type === 'audio' && o?.data)
    const texts = outputs.filter((o: any) => o?.type === 'text' && o?.text).map((o: any) => o.text)

    if (!audio?.data) {
      return NextResponse.json({
        error: 'O Lyria respondeu, mas não encontrei áudio na resposta.',
        details: JSON.stringify(data, null, 2).slice(0, 8000),
      }, { status: 502 })
    }

    return NextResponse.json({
      audio: `data:${audio.mime_type || 'audio/mpeg'};base64,${audio.data}`,
      lyrics: texts[0] || '',
      description: texts[1] || '',
      model: data?.model || MODEL,
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Erro interno no laboratório do Lyria.',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
