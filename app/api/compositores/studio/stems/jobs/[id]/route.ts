import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { resolveStemSignedUrls } from '@/lib/studio-stems'
import { createStudioAudioSignedUrl } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'
import {
  STUDIO_STEM_EXPORT_CREDITS,
  STUDIO_STEM_SEPARATION_CREDITS,
} from '@/lib/studio'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const jobId = context.params.id
    const { data: job, error } = await supabaseAdmin
      .from('studio_stem_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!job) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })

    const stems = await resolveStemSignedUrls(job.stems || [])
    const sourceAudioUrl = job.source_audio_path
      ? await createStudioAudioSignedUrl(job.source_audio_path, job.source_audio_storage_provider)
      : job.source_audio_url

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        provider: job.provider,
        projectId: job.project_id,
        sourceVersionId: job.source_version_id,
        sourceTitle: job.source_title,
        sourceAudioUrl,
        error: job.error,
        separationCharged: job.separation_charged,
        separationRefunded: job.separation_refunded,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
      stems: stems.map((stem) => ({
        id: stem.id,
        type: stem.type,
        name: stem.name,
        url: stem.url,
        path: stem.path || null,
        volume: stem.volume,
        muted: false,
        solo: false,
      })),
      pricing: {
        separationCredits: STUDIO_STEM_SEPARATION_CREDITS,
        exportCredits: STUDIO_STEM_EXPORT_CREDITS,
      },
    })
  } catch (error: any) {
    console.error('[Studio Stems] job get error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar job' },
      { status: 500 }
    )
  }
}
