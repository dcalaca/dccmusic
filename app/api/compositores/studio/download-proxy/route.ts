import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prepareStudioMp3Download } from '@/lib/studio-download-audio'
import { getComposerFromRequest } from '@/lib/composer-middleware'

export const runtime = 'nodejs'
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
    host === 'audiostream.api.box' ||
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

function normalizedAudioContentType(source: URL, upstreamContentType: string | null, video = false) {
  const type = String(upstreamContentType || '').toLowerCase()
  const path = source.pathname.toLowerCase()

  if (video && (path.endsWith('.mp4') || type.includes('mp4'))) return 'video/mp4'
  if (path.endsWith('.mp3') || type.includes('mpeg') || type.includes('mp3')) return 'audio/mpeg'
  if (path.endsWith('.m4a') || path.endsWith('.mp4') || type.includes('mp4')) return 'audio/mp4'
  if (path.endsWith('.wav') || type.includes('wav')) return 'audio/wav'
  if (path.endsWith('.ogg') || type.includes('ogg')) return 'audio/ogg'
  return type.startsWith('audio/') ? type : 'audio/mpeg'
}

export async function POST(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  const adminSession = composer ? null : await getServerSession(authOptions)
  if (!composer && !adminSession) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!rawUrl) return NextResponse.json({ errorCode: 'missingAudioUrl' }, { status: 400 })

    const source = new URL(rawUrl)
    if (source.protocol !== 'https:' || !isAllowedAudioHost(source.hostname)) {
      return NextResponse.json({ errorCode: 'audioOriginNotAllowed' }, { status: 400 })
    }

    const upstream = await fetch(source.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'video/*,audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; DCCMusicDownload/1.0)',
      },
    })

    if (!upstream.ok || upstream.status === 206 || upstream.headers.has('content-range')) {
      return NextResponse.json({ errorCode: 'audioDownloadFailed', upstreamStatus: upstream.status }, { status: 502 })
    }

    const bytes = await upstream.arrayBuffer()
    if (!bytes.byteLength) {
      return NextResponse.json({ errorCode: 'emptyAudioFile' }, { status: 502 })
    }

    const contentType = normalizedAudioContentType(source, upstream.headers.get('content-type'), body?.mediaType === 'video')
    const downloadBytes = contentType === 'audio/mpeg'
      ? await prepareStudioMp3Download(bytes)
      : bytes
    const extension = body?.mediaType === 'video' ? 'mp4' : 'mp3'
    const filename = (typeof body?.filename === 'string' ? body.filename : `dcc-music.${extension}`)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim().slice(0, 180) || `dcc-music.${extension}`
    const asciiFilename = filename.normalize('NFD').replace(/[^\x20-\x7E]/g, '') || `dcc-music.${extension}`
    const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

    return new NextResponse(downloadBytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(downloadBytes.byteLength),
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error: any) {
    console.error('[Studio Download Proxy] Erro:', error)
    return NextResponse.json({ errorCode: 'prepareDownloadFailed' }, { status: 500 })
  }
}
