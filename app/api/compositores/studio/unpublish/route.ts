import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getComposerPremiumAccess, getProjectForComposer, getStudioAccess } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const [{ hasAccess: hasStudioAccess }, hasAnyActivePlan] = await Promise.all([
      getStudioAccess(composer.composerId),
      getComposerPremiumAccess(composer.composerId),
    ])

    if (!hasStudioAccess && !hasAnyActivePlan) {
      return NextResponse.json(
        { error: 'Para despublicar, é necessário ter uma assinatura ativa.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    if (project.status !== 'published') {
      return NextResponse.json(
        { error: 'Esta música não está publicada.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const [{ error: versionsError }, { data, error: projectError }] = await Promise.all([
      supabaseAdmin
        .from('studio_versions')
        .update({ is_published: false, updated_at: now })
        .eq('project_id', project.id)
        .eq('composer_id', composer.composerId),
      supabaseAdmin
        .from('studio_projects')
        .update({
          status: 'ready',
          public_slug: null,
          published_at: null,
          updated_at: now,
        })
        .eq('id', project.id)
        .eq('composer_id', composer.composerId)
        .select('id, status, public_slug')
        .single(),
    ])

    if (versionsError) throw versionsError
    if (projectError) throw projectError

    return NextResponse.json({
      success: true,
      status: data.status,
      publicSlug: data.public_slug,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro despublicar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao despublicar música' }, { status: 500 })
  }
}
