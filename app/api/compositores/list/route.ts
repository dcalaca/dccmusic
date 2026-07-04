import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca') || ''

    let query = supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(100)

    if (busca.trim()) {
      query = query.ilike('name', `%${busca.trim()}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao listar compositores para compositor:', error)
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
    console.error('Erro ao listar compositores para compositor:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar compositores' },
      { status: 500 }
    )
  }
}
