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
    const musicId = searchParams.get('musicId') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const { rows, queryError, truncated } = await db.getAdminMusicViewsForExport({
      musicId: musicId || null,
      startDate: startDate || null,
      endDate: endDate || null,
    })

    return NextResponse.json({
      views: rows,
      truncated,
      ...(queryError ? { queryError } : {}),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao exportar'
    console.error('Erro export music views:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
