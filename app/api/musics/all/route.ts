import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Buscar TODAS as músicas sem filtros
    const musics = await db.getMusics({ ordem: 'recentes' })
    return NextResponse.json({ musics })
  } catch (error) {
    console.error('Erro ao buscar músicas:', error)
    return NextResponse.json({ musics: [] }, { status: 500 })
  }
}
