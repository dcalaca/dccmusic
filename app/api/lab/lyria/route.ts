import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dccmusic'
const MODEL = process.env.GOOGLE_LYRIA_MODEL || 'lyria-3-pro-preview'

export async function POST(req: NextRequest) {
  try {
    const { prompt, lyrics } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Informe uma descrição para a música.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY
    const accessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN
    if (!apiKey && !accessToken) {
      return NextResponse.json({ error: 'Credencial Google Cloud não configurada no ambiente de teste.' }, { status: 500 })
    }

    const text = lyrics?.trim()
      ? `${prompt.trim()}\n\nUse the following user-provided lyrics exactly as the song lyrics, preserving sections and language:\n${lyrics.trim()}`
      : prompt.trim()

    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    else if (apiKey) headers['x-goog-api-key'] = apiKey

    const response = await fetch(
      `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/global/interactions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: MODEL,
          input: [{ type: 'text', text }],
        }),
        cache: 'no-store',
      }
    )

    const raw = await response.text()
    let data: any
    try { data = JSON.parse(raw) } catch { data = null }

    if (!response.ok) {
      return NextResponse.json({
        error: `Google Lyria respondeu HTTP ${response.status}.`,
        details: data?.error?.message || raw || 'Resposta sem detalhes.',
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
