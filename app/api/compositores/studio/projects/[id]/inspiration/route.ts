import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { createUniqueProjectSlug, getCurrentProjectAssets, getProjectForComposer, mapStudioProject } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { formatMusicTitle } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

const inspirationVariationInstructions: Record<string, { label: string; instruction: string; audioWeight: number }> = {
  similar: {
    label: 'Parecida com a anterior',
    instruction: 'Use a música original como inspiração e mantenha andamento, energia, melodia e pegada parecidos.',
    audioWeight: 0.75,
  },
  same_style_new_melody: {
    label: 'Mesmo estilo, mas melodia diferente',
    instruction: 'Mantenha o mesmo estilo musical da original, mas crie uma melodia inédita, uma nova introdução, nova levada e nova progressão melódica. Não copie a melodia nem a pegada exata da música anterior.',
    audioWeight: 0.45,
  },
  creative: {
    label: 'Mais criativa / fugir mais da anterior',
    instruction: 'Use a música original apenas como referência leve de qualidade e intenção. Mantenha o estilo do projeto, mas crie uma abordagem bem diferente, com nova melodia, nova introdução, nova levada, novo arranjo e interpretação vocal diferente.',
    audioWeight: 0.3,
  },
  faster: {
    label: 'Um pouco mais rápido',
    instruction: 'Use a música original como inspiração, mas crie uma versão um pouco mais rápida, com andamento levemente acelerado, sem perder o estilo original.',
    audioWeight: 0.65,
  },
  energetic: {
    label: 'Mais animado',
    instruction: 'Use a música original como inspiração, mas crie uma versão mais animada, com mais energia, mais pegada e clima mais empolgante.',
    audioWeight: 0.65,
  },
  slower_romantic: {
    label: 'Mais lento/romântico',
    instruction: 'Use a música original como inspiração, mas crie uma versão mais lenta, romântica e emocional.',
    audioWeight: 0.65,
  },
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const sourceProject = await getProjectForComposer(params.id, composer.composerId)
    if (!sourceProject) return NextResponse.json({ error: 'Projeto de inspiração não encontrado' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const variation = inspirationVariationInstructions[body?.variation] ? body.variation : 'similar'
    const variationConfig = inspirationVariationInstructions[variation]
    const lyricOverride = typeof body?.lyric === 'string' ? body.lyric.trim() : ''
    const requestedSourceVersionId = typeof body?.sourceVersionId === 'string' ? body.sourceVersionId.trim() : ''

    const { lyric, version: currentVersion } = await getCurrentProjectAssets(sourceProject.id)
    const version = requestedSourceVersionId
      ? await supabaseAdmin
          .from('studio_versions')
          .select('*')
          .eq('id', requestedSourceVersionId)
          .eq('project_id', sourceProject.id)
          .eq('composer_id', composer.composerId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error
            return data
          })
      : currentVersion

    if (!version?.id || (!version.audio_url && !version.stream_audio_url && !version.audio_path && !version.stream_audio_path)) {
      return NextResponse.json({ error: 'Essa música ainda não tem áudio pronto para usar como inspiração.' }, { status: 400 })
    }

    const title = formatMusicTitle(`${String(sourceProject.title || 'Música').slice(0, 18)} - nova letra`)
    const slug = await createUniqueProjectSlug(composer.composerId, title)

    const { data: targetProject, error: projectError } = await supabaseAdmin
      .from('studio_projects')
      .insert({
        composer_id: composer.composerId,
        title,
        slug,
        style: sourceProject.style,
        mood: sourceProject.mood,
        structure: sourceProject.structure,
        line_count: sourceProject.line_count,
        status: 'draft',
        description: [
          `Usar de inspiração: ${sourceProject.title}`,
          `Direção da inspiração: ${variationConfig.label}. ${variationConfig.instruction}`,
          sourceProject.description || null,
        ].filter(Boolean).join('\n'),
      })
      .select('*')
      .single()

    if (projectError) throw projectError

    const targetLyric = lyricOverride || lyric?.content || ''
    if (targetLyric) {
      const { error: lyricError } = await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: targetProject.id,
          composer_id: composer.composerId,
          content: targetLyric,
          is_current: true,
        })
      if (lyricError) throw lyricError
    }

    const { error: inspirationError } = await supabaseAdmin
      .from('studio_inspiration_requests')
      .insert({
        composer_id: composer.composerId,
        source_project_id: sourceProject.id,
        source_version_id: version.id,
        target_project_id: targetProject.id,
        status: 'created',
        request_payload: {
          sourceTitle: sourceProject.title,
          sourceStyle: sourceProject.style,
          sourceMood: sourceProject.mood,
          sourceVersionName: version.version_name || null,
          variation,
          variationLabel: variationConfig.label,
          inspirationInstruction: variationConfig.instruction,
          audioWeight: variationConfig.audioWeight,
        },
      })

    if (inspirationError) throw inspirationError

    return NextResponse.json({ project: mapStudioProject(targetProject) })
  } catch (error: any) {
    console.error('[Studio IA] Erro criar inspiração:', error)
    return NextResponse.json({ error: error.message || 'Erro ao usar música como inspiração' }, { status: 500 })
  }
}
