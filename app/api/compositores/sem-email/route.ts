import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca') || ''

    // Buscar compositores sem email
    let query = supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, slug')
      .is('email', null)
      .order('name', { ascending: true })
      .limit(50)

    // Se tem busca, filtrar por nome
    if (busca.trim()) {
      query = query.ilike('name', `%${busca.trim()}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar compositores sem email:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar compositores' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      composers: data || [],
    })
  } catch (error: any) {
    console.error('Erro ao buscar compositores sem email:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar compositores' },
      { status: 500 }
    )
  }
}
