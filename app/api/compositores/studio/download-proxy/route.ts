import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function configuredR2PublicHost() {
  const raw = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || ''
  if (!raw) return ''
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isAllowedAudioHost(hostname: string) {
  const host = hostname.toLowerCase()
  const configuredHost = configuredR2PublicHost()
  if (configuredHost && host === configuredHost) return true

  return (
    host === 'cdn1.suno.ai' ||
    host.endsWith('.suno.ai') ||
    host.endsWith('.sunoapi.org') ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.r2.dev') ||
    host.endsWith('.r2.cloudflarestorage.com') ||
    host === 'tempfile.aiquickdraw.com' ||
    host === 'musicfile.removeai.ai' ||
    host.endsWith('.mureka.ai')
  )
}

export async function POST(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!rawUrl) return NextResponse.json({ error: 'URL do áudio não informada.' }, { status: 400 })

    const source = new URL(rawUrl)
    if (source.protocol !== 'https:' || !isAllowedAudioHost(source.hostname)) {
      return NextResponse.json({ error: 'Origem do áudio não permitida.' }, { status: 400 })
    }

    const upstream = await fetch(source.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; DCCMusicDownload/1.0)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: `Não foi possível baixar o áudio (${upstream.status}).` }, { status: 502 })
    }

    const bytes = await upstream.arrayBuffer()
    if (!bytes.byteLength) {
      return NextResponse.json({ error: 'O arquivo de áudio está vazio.' }, { status: 502 })
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error: any) {
    console.error('[Studio Download Proxy] Erro:', error)
    return NextResponse.json({ error: 'Não foi possível preparar o download.' }, { status: 500 })
  }
}
