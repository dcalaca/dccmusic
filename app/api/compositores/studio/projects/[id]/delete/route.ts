import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getProjectForComposer } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const project = await getProjectForComposer(params.id, composer.composerId)
    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('studio_projects')
      .delete()
      .eq('id', params.id)
      .eq('composer_id', composer.composerId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Studio IA] Erro excluir projeto:', error)
    return NextResponse.json(
      { error: error.message || 'Não foi possível excluir o projeto' },
      { status: 500 }
    )
  }
}
