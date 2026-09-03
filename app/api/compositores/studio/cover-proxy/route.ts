import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const STUDIO_COVER_BUCKET = 'studio-assets'

function isAllowedStudioCoverUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      (
        url.pathname.startsWith(`/storage/v1/object/sign/${STUDIO_COVER_BUCKET}/`) ||
        url.pathname.startsWith(`/storage/v1/render/image/sign/${STUDIO_COVER_BUCKET}/`)
      ) &&
      Boolean(url.searchParams.get('token'))
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get('url') || ''
  if (!isAllowedStudioCoverUrl(sourceUrl)) {
    return NextResponse.json({ error: 'URL de capa inválida.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(sourceUrl, {
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Não foi possível carregar a capa.' }, { status: 502 })
    }

    const image = await upstream.arrayBuffer()
    if (!image.byteLength) {
      return NextResponse.json({ error: 'A capa está vazia.' }, { status: 502 })
    }

    return new NextResponse(image, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Content-Length': String(image.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.warn('[Studio Cover Proxy] Falha ao buscar capa:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a capa.' }, { status: 502 })
  }
}
