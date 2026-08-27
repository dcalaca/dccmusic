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

    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('show_in_premium_directory')
      .eq('id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      visible: data.show_in_premium_directory !== false,
    })
  } catch (error: any) {
    console.error('[DIRECTORY VISIBILITY] Erro ao consultar preferência:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar preferência de visibilidade' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.visible !== 'boolean') {
      return NextResponse.json(
        { error: 'O campo visible deve ser verdadeiro ou falso' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        show_in_premium_directory: body.visible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', composer.composerId)
      .select('show_in_premium_directory')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      visible: data.show_in_premium_directory !== false,
    })
  } catch (error: any) {
    console.error('[DIRECTORY VISIBILITY] Erro ao salvar preferência:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao salvar preferência de visibilidade' },
      { status: 500 }
    )
  }
}
