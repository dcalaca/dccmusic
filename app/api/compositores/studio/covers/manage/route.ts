import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getProjectForComposer } from '@/lib/studio'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const projectId = String(body.projectId || '')
    const coverId = String(body.coverId || '')
    const action = String(body.action || '')

    if (!projectId || !coverId || !['select', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Ação de capa inválida.' }, { status: 400 })
    }

    const project = await getProjectForComposer(projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { data: cover, error: coverError } = await supabaseAdmin
      .from('studio_covers')
      .select('*')
      .eq('id', coverId)
      .eq('project_id', projectId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (coverError) throw coverError
    if (!cover) return NextResponse.json({ error: 'Capa não encontrada.' }, { status: 404 })

    if (action === 'select') {
      await supabaseAdmin
        .from('studio_covers')
        .update({ is_current: false })
        .eq('project_id', projectId)
        .eq('composer_id', composer.composerId)

      const { data: selected, error } = await supabaseAdmin
        .from('studio_covers')
        .update({ is_current: true })
        .eq('id', coverId)
        .eq('project_id', projectId)
        .eq('composer_id', composer.composerId)
        .select('*')
        .single()

      if (error) throw error

      return NextResponse.json({
        cover: {
          id: selected.id,
          imageUrl: await getStudioCoverImageUrl(selected),
          isPremium: Boolean(selected.is_premium),
          isCurrent: true,
          provider: selected.provider || null,
          createdAt: selected.created_at,
        },
      })
    }

    const { data: remainingCovers, error: remainingError } = await supabaseAdmin
      .from('studio_covers')
      .select('*')
      .eq('project_id', projectId)
      .eq('composer_id', composer.composerId)
      .neq('id', coverId)
      .order('created_at', { ascending: false })

    if (remainingError) throw remainingError
    if (!remainingCovers?.length) {
      return NextResponse.json({ error: 'O projeto precisa manter pelo menos uma capa.' }, { status: 400 })
    }

    const nextCurrent = cover.is_current
      ? (remainingCovers.find((item: any) => item.is_current) || remainingCovers[0])
      : null

    if (cover.is_current && nextCurrent) {
      await supabaseAdmin
        .from('studio_covers')
        .update({ is_current: false })
        .eq('project_id', projectId)
        .eq('composer_id', composer.composerId)

      await supabaseAdmin
        .from('studio_covers')
        .update({ is_current: true })
        .eq('id', nextCurrent.id)
        .eq('project_id', projectId)
        .eq('composer_id', composer.composerId)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('studio_covers')
      .delete()
      .eq('id', coverId)
      .eq('project_id', projectId)
      .eq('composer_id', composer.composerId)

    if (deleteError) throw deleteError

    if (cover.image_path) {
      await supabaseAdmin.storage.from('studio-assets').remove([cover.image_path]).catch(() => null)
    }

    const currentCover = nextCurrent
      ? {
          id: nextCurrent.id,
          imageUrl: await getStudioCoverImageUrl(nextCurrent),
          isPremium: Boolean(nextCurrent.is_premium),
          isCurrent: true,
          provider: nextCurrent.provider || null,
          createdAt: nextCurrent.created_at,
        }
      : null

    return NextResponse.json({ success: true, currentCover })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao gerenciar capa:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerenciar capa' }, { status: 500 })
  }
}
