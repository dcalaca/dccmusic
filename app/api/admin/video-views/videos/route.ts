import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Lista de vídeos para filtro no relatório de visualizações
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_videos')
      .select('id, title, slug')
      .order('title', { ascending: true })

    if (error) throw error

    return NextResponse.json({ videos: data || [] })
  } catch (error: any) {
    console.error('Erro ao listar vídeos (filtro visualizações):', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar vídeos' },
      { status: 500 }
    )
  }
}
