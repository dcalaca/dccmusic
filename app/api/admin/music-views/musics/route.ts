import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_musics')
      .select('id, title, slug')
      .order('title', { ascending: true })

    if (error) throw error

    return NextResponse.json({ musics: data || [] })
  } catch (error: any) {
    console.error('Erro ao listar músicas (filtro visualizações):', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar músicas' },
      { status: 500 }
    )
  }
}
