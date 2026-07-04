import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getComposerPremiumAccess, getCurrentProjectAssets, getProjectForComposer, getStudioAccess } from '@/lib/studio'
import { slugify } from '@/lib/utils'
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
        { error: 'Para publicar no DCC Music, é necessário ter uma assinatura ativa.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { lyric, version } = await getCurrentProjectAssets(project.id)
    if (!lyric?.content || !(version?.audio_url || version?.stream_audio_url)) {
      return NextResponse.json(
        { error: 'Finalize a letra e a música antes de publicar.' },
        { status: 400 }
      )
    }

    const publicSlug = project.public_slug || `${slugify(project.title)}-${Date.now().toString(36)}`

    await supabaseAdmin
      .from('studio_versions')
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq('id', version.id)

    const { data, error } = await supabaseAdmin
      .from('studio_projects')
      .update({
        status: 'published',
        public_slug: publicSlug,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)
      .eq('composer_id', composer.composerId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      publicUrl: `/studio/${data.public_slug}`,
      publicSlug: data.public_slug,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro publicar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao publicar música' }, { status: 500 })
  }
}
