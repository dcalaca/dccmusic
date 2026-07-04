import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { getComposerFromRequest } from '@/lib/composer-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType') as 'music' | 'video'
    const contentId = searchParams.get('contentId')

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType e contentId são obrigatórios' },
        { status: 400 }
      )
    }

    const featured = await db.getActiveFeatured(contentType, contentId)

    if (!featured) {
      return NextResponse.json({
        isActive: false,
      })
    }

    return NextResponse.json({
      isActive: featured.isActive,
      expiresAt: featured.expiresAt.toISOString(),
      paymentStatus: featured.paymentStatus,
    })
  } catch (error: any) {
    console.error('Erro ao buscar status do destaque:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar status' },
      { status: 500 }
    )
  }
}
