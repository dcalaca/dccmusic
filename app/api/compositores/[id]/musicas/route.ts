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

    console.log('[API] GET /api/compositores/[id]/musicas - composerId:', composerId)

    if (!composerId) {
      return NextResponse.json(
        { error: 'ID do compositor é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar SEM filtros - retornar TODAS as músicas do compositor
    const musics = await db.getMusicsByComposer(composerId, {})

    console.log('[API] Músicas retornadas:', musics.length)
    console.log('[API] IDs das músicas:', musics.map(m => ({ id: m.id, title: m.title })))

    return NextResponse.json({
      success: true,
      musics,
    })
  } catch (error: any) {
    console.error('[API] Erro ao buscar músicas do compositor:', error)
    console.error('[API] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar músicas' },
      { status: 500 }
    )
  }
}
