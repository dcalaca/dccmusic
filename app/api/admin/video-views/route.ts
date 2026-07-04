import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const videoId = searchParams.get('videoId') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const { rows, total, queryError } = await db.getAdminVideoViewsList({
      page,
      limit,
      videoId: videoId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    })

    return NextResponse.json({
      views: rows,
      total,
      page,
      limit,
      ...(queryError ? { queryError } : {}),
    })
  } catch (error: any) {
    console.error('Erro ao listar visualizações de vídeo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar visualizações' },
      { status: 500 }
    )
  }
}
