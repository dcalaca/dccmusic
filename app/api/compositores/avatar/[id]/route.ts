import { NextRequest, NextResponse } from 'next/server'
import { getComposerProfilePhotoUrl } from '@/lib/composer-profile-photo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params)
    const composerId = String(params?.id || '').trim()
    if (!composerId) {
      return new NextResponse('Not found', { status: 404 })
    }

    const signedUrl = await getComposerProfilePhotoUrl(composerId)
    if (!signedUrl) {
      return new NextResponse('Not found', {
        status: 404,
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    const upstream = await fetch(signedUrl, { cache: 'no-store' })
    if (!upstream.ok || !upstream.body) {
      return new NextResponse('Not found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    headers.set('Cache-Control', CACHE_CONTROL)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[COMPOSER AVATAR] Erro:', error)
    return new NextResponse('Error', { status: 500 })
  }
}
