import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  canSeparateStudioStemsWithCredits,
  getProjectForComposer,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_STEM_SEPARATION_CREDITS,
} from '@/lib/studio'
import { createStudioAudioSignedUrl, getStudioVersionAudioUrls, uploadStudioInputAudio } from '@/lib/studio-audio-backup'
import {
  chargeStemSeparation,
  markJobFailed,
  markJobReady,
  prepareStemSeparationSource,
  refundStemSeparation,
  requestMurekaStemSeparation,
  stemsFromMurekaZip,
} from '@/lib/studio-stems'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    if (!canSeparateStudioStemsWithCredits(usage)) {
      return NextResponse.json({
        error: `Separar instrumentos custa ${STUDIO_STEM_SEPARATION_CREDITS} créditos (mesmo valor de criar uma música). Seu saldo é insuficiente.`,
        creditsRequired: STUDIO_STEM_SEPARATION_CREDITS,
        creditsRemaining: usage.remaining,
      }, { status: 402 })
    }

    const contentType = request.headers.get('content-type') || ''
    let projectId: string | null = null
    let versionId: string | null = null
    let version: any = null
    let sourceTitle: string | null = null
    let sourceAudioUrl: string | null = null
    let sourceAudioPath: string | null = null
    let sourceAudioStorageProvider: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('audio')
      projectId = typeof form.get('projectId') === 'string' ? String(form.get('projectId')) : null
      sourceTitle = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : null

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Envie um arquivo de áudio.' }, { status: 400 })
      }

      const uploaded = await uploadStudioInputAudio({
        composerId: composer.composerId,
        file,
        kind: 'enhance-source',
      })
      sourceAudioPath = uploaded.path
      sourceAudioStorageProvider = uploaded.provider
      sourceAudioUrl = await createStudioAudioSignedUrl(uploaded.path, uploaded.provider)
      sourceTitle = sourceTitle || file.name.replace(/\.[^.]+$/, '') || 'Upload Studio'
    } else {
      const body = await request.json()
      projectId = body.projectId || null
      versionId = body.versionId || null
      sourceTitle = typeof body.title === 'string' ? body.title.trim() : null

      if (!projectId) {
        return NextResponse.json({ error: 'Informe o projeto ou envie um áudio.' }, { status: 400 })
      }

      const project = await getProjectForComposer(projectId, composer.composerId)
      if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
      sourceTitle = sourceTitle || project.title

      let versionQuery = supabaseAdmin
        .from('studio_versions')
        .select('*')
        .eq('project_id', project.id)
        .eq('composer_id', composer.composerId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (versionId) {
        versionQuery = supabaseAdmin
          .from('studio_versions')
          .select('*')
          .eq('id', versionId)
          .eq('project_id', project.id)
          .eq('composer_id', composer.composerId)
          .limit(1)
      }

      const { data: versions, error: versionError } = await versionQuery
      if (versionError) throw versionError
      version = versions?.[0]
      if (!version) {
        return NextResponse.json({ error: 'Este projeto ainda não tem áudio para separar.' }, { status: 400 })
      }

      versionId = version.id
      const audio = await getStudioVersionAudioUrls(version)
      sourceAudioUrl = audio.audioUrl || audio.streamAudioUrl
      sourceAudioPath = version.audio_path || version.stream_audio_path || null
      sourceAudioStorageProvider = version.audio_storage_provider || version.stream_audio_storage_provider || null
    }

    if (!sourceAudioUrl && !sourceAudioPath) {
      return NextResponse.json({ error: 'Não foi possível obter a URL do áudio de origem.' }, { status: 400 })
    }

    if (projectId) {
      const project = await getProjectForComposer(projectId, composer.composerId)
      if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    let prepared
    try {
      prepared = await prepareStemSeparationSource({
        version,
        sourceAudioUrl,
        sourceAudioPath,
        sourceAudioStorageProvider,
      })
    } catch (prepareError: any) {
      return NextResponse.json({
        error: prepareError?.message || 'Não foi possível preparar o áudio para separação.',
      }, { status: 400 })
    }

    sourceAudioUrl = prepared.publicAudioUrl

    const { data: job, error: jobError } = await supabaseAdmin
      .from('studio_stem_jobs')
      .insert({
        composer_id: composer.composerId,
        project_id: projectId,
        source_version_id: versionId,
        source_audio_url: sourceAudioUrl,
        source_audio_path: sourceAudioPath,
        source_audio_storage_provider: sourceAudioStorageProvider,
        source_title: sourceTitle,
        status: 'processing',
        provider: 'mureka',
      })
      .select('*')
      .maybeSingle()

    if (jobError) throw jobError
    if (!job) throw new Error('Não foi possível criar o job de separação.')

    await chargeStemSeparation({
      composerId: composer.composerId,
      projectId,
      jobId: job.id,
    })

    try {
      const mureka = await requestMurekaStemSeparation(prepared.publicAudioUrl)
      const stems = await stemsFromMurekaZip({
        composerId: composer.composerId,
        jobId: job.id,
        zipUrl: mureka.zipUrl,
      })
      await markJobReady(job.id, stems, 'mureka', {
        mureka: mureka.payload,
        publicAudioUrl: prepared.publicAudioUrl,
      })

      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: 'ready',
        provider: 'mureka',
        creditsCharged: STUDIO_STEM_SEPARATION_CREDITS,
        message: `Separação concluída. Foram debitados ${STUDIO_STEM_SEPARATION_CREDITS} créditos.`,
      })
    } catch (murekaError: any) {
      const message = murekaError?.message || 'Falha ao separar áudio com a Mureka.'
      await markJobFailed(job.id, message)
      await refundStemSeparation({
        composerId: composer.composerId,
        projectId,
        jobId: job.id,
        reason: message,
      })
      return NextResponse.json({
        error: message,
        refunded: true,
        jobId: job.id,
      }, { status: 502 })
    }
  } catch (error: any) {
    console.error('[Studio Stems] separate error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar separação' },
      { status: 500 }
    )
  }
}
