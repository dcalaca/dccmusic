import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Buscar TODOS os vídeos sem filtros
    const videos = await db.getVideos({ ordem: 'recentes' })
    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Erro ao buscar vídeos:', error)
    return NextResponse.json({ videos: [] }, { status: 500 })
  }
}
