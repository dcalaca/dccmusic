import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const composerId = params.id

    console.log('[API] GET /api/compositores/[id]/videos - composerId:', composerId)

    if (!composerId) {
      return NextResponse.json(
        { error: 'ID do compositor é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar SEM filtros - retornar TODOS os vídeos do compositor
    const videos = await db.getVideosByComposer(composerId, {})

    console.log('[API] Vídeos retornados:', videos.length)
    console.log('[API] IDs dos vídeos:', videos.map(v => ({ id: v.id, title: v.title })))

    return NextResponse.json({
      success: true,
      videos,
    })
  } catch (error: any) {
    console.error('[API] Erro ao buscar vídeos do compositor:', error)
    console.error('[API] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar vídeos' },
      { status: 500 }
    )
  }
}
