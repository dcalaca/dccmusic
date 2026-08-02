import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  canExportStudioStemMixWithCredits,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_STEM_EXPORT_CREDITS,
} from '@/lib/studio'
import { backupStudioVersionAudio, createStudioAudioSignedUrl } from '@/lib/studio-audio-backup'
import {
  buildMixFingerprint,
  chargeStemExport,
  ensureProjectForStemJob,
  mixStemsWithFfmpeg,
  normalizeMixTrim,
  type MixStemState,
  type MixTrim,
  type StoredStem,
} from '@/lib/studio-stems'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const jobId = String(body.jobId || '')
    const mix = (Array.isArray(body.stems) ? body.stems : []) as MixStemState[]
    const trim = normalizeMixTrim((body.trim || null) as MixTrim | null)

    if (!jobId) return NextResponse.json({ error: 'jobId obrigatório.' }, { status: 400 })
    if (mix.length === 0) {
      return NextResponse.json({ error: 'Envie o estado das faixas (volumes/mute/solo).' }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('studio_stem_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (jobError) throw jobError
    if (!job) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })
    if (job.status !== 'ready') {
      return NextResponse.json({ error: 'A separação ainda não está pronta.' }, { status: 400 })
    }

    const fingerprint = buildMixFingerprint(jobId, mix, trim)

    const { data: existingExport } = await supabaseAdmin
      .from('studio_stem_exports')
      .select('*')
      .eq('job_id', jobId)
      .eq('mix_fingerprint', fingerprint)
      .maybeSingle()

    if (existingExport?.version_id) {
      const { data: version } = await supabaseAdmin
        .from('studio_versions')
        .select('*')
        .eq('id', existingExport.version_id)
        .maybeSingle()

      const audioUrl = version
        ? await createStudioAudioSignedUrl(version.audio_path, version.audio_storage_provider) || version.audio_url
        : null

      return NextResponse.json({
        success: true,
        charged: false,
        creditsCharged: 0,
        message: 'Esta mesma mix já foi exportada. Re-download gratuito.',
        projectId: existingExport.project_id,
        versionId: existingExport.version_id,
        audioUrl,
        projectUrl: existingExport.project_id
          ? `/compositores/admin/studio-ia/projetos/${existingExport.project_id}`
          : null,
      })
    }

    const { limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    if (!canExportStudioStemMixWithCredits(usage)) {
      return NextResponse.json({
        error: `Exportar e salvar no projeto custa ${STUDIO_STEM_EXPORT_CREDITS} crédito. Saldo insuficiente.`,
        creditsRequired: STUDIO_STEM_EXPORT_CREDITS,
        creditsRemaining: usage.remaining,
      }, { status: 402 })
    }

    const project = await ensureProjectForStemJob(job)
    const storedStems = (job.stems || []) as StoredStem[]
    const mixed = await mixStemsWithFfmpeg({
      composerId: composer.composerId,
      jobId: job.id,
      stems: storedStems,
      mix,
      trim,
    })

    const publicOrSigned = await createStudioAudioSignedUrl(mixed.path, mixed.provider)

    await supabaseAdmin
      .from('studio_versions')
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq('project_id', project.id)

    const { data: version, error: versionError } = await supabaseAdmin
      .from('studio_versions')
      .insert({
        project_id: project.id,
        composer_id: composer.composerId,
        version_name: 'Mix Studio',
        audio_url: publicOrSigned,
        stream_audio_url: publicOrSigned,
        is_current: true,
        provider_payload: {
          source: 'studio_mixer',
          jobId: job.id,
          fingerprint,
          mix,
          trim,
          audio_path: mixed.path,
          audio_storage_provider: mixed.provider,
        },
      })
      .select('*')
      .maybeSingle()

    if (versionError) throw versionError

    await backupStudioVersionAudio({
      versionId: version.id,
      composerId: composer.composerId,
      audioUrl: publicOrSigned,
      streamAudioUrl: publicOrSigned,
      forceFullAudioUpgrade: true,
    }).catch((backupError) => {
      console.error('[Studio Stems] backup export error:', backupError)
    })

    try {
      await supabaseAdmin
        .from('studio_versions')
        .update({
          audio_path: mixed.path,
          audio_storage_provider: mixed.provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', version.id)
    } catch {
      // Schema antigo sem colunas de backup — ignorar
    }

    await supabaseAdmin
      .from('studio_projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', project.id)

    await chargeStemExport({
      composerId: composer.composerId,
      projectId: project.id,
      jobId: job.id,
      fingerprint,
      versionId: version.id,
    })

    await supabaseAdmin
      .from('studio_stem_exports')
      .insert({
        job_id: job.id,
        composer_id: composer.composerId,
        project_id: project.id,
        version_id: version.id,
        mix_fingerprint: fingerprint,
        export_charged: true,
      })

    return NextResponse.json({
      success: true,
      charged: true,
      creditsCharged: STUDIO_STEM_EXPORT_CREDITS,
      message: `Mix salva no projeto. Foram debitados ${STUDIO_STEM_EXPORT_CREDITS} crédito.`,
      projectId: project.id,
      versionId: version.id,
      audioUrl: publicOrSigned,
      projectUrl: `/compositores/admin/studio-ia/projetos/${project.id}`,
    })
  } catch (error: any) {
    console.error('[Studio Stems] export error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao exportar mix' },
      { status: 500 }
    )
  }
}
