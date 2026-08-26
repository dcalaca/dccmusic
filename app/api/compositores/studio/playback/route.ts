import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createStudioPlayback } from '@/lib/admin-playback'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  getProjectForComposer,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_MUSIC_CREDITS,
} from '@/lib/studio'
import { createStudioAudioSignedUrl, getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let charged = false
  let projectId: string | null = null
  const requestId = randomUUID()

  try {
    const body = await request.json()
    projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const versionId = typeof body.versionId === 'string' ? body.versionId.trim() : ''
    if (!projectId || !versionId) {
      return NextResponse.json({ error: 'Escolha um projeto e uma versão.' }, { status: 400 })
    }

    const project = await getProjectForComposer(projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { data: version, error: versionError } = await supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('id', versionId)
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)
      .maybeSingle()
    if (versionError) throw versionError
    if (!version) return NextResponse.json({ error: 'Versão não encontrada neste projeto.' }, { status: 404 })

    const audio = await getStudioVersionAudioUrls(version)
    const sourceUrl = audio?.audioUrl || audio?.streamAudioUrl
    if (!sourceUrl) return NextResponse.json({ error: 'Essa versão ainda não possui áudio disponível.' }, { status: 422 })

    const access = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, access.limits)
    if (usage.remaining < STUDIO_MUSIC_CREDITS) {
      return NextResponse.json({
        error: `Você precisa de ${STUDIO_MUSIC_CREDITS} créditos para criar o playback.`,
        creditsRequired: STUDIO_MUSIC_CREDITS,
        creditsRemaining: usage.remaining,
      }, { status: 402 })
    }

    await addStudioCreditTransaction({
      composerId: composer.composerId,
      projectId: project.id,
      action: 'stem_separation',
      amount: STUDIO_MUSIC_CREDITS,
      description: 'Criação de playback (retirada de voz)',
      metadata: { requestId, versionId, feature: 'playback' },
    })
    charged = true

    const playback = await createStudioPlayback({
      sourceUrl,
      title: project.title || version.version_name || 'musica',
      composerId: composer.composerId,
    })
    const playbackUrl = await createStudioAudioSignedUrl(playback.path, playback.provider)
    if (!playbackUrl) throw new Error('Playback criado, mas não foi possível gerar o link para baixar.')

    const usageAfter = await getStudioCreditUsage(composer.composerId, access.limits)
    return NextResponse.json({
      success: true,
      playbackUrl,
      provider: playback.separationProvider,
      creditsCharged: STUDIO_MUSIC_CREDITS,
      creditsRemaining: usageAfter.remaining,
    })
  } catch (error: any) {
    console.error('[Studio Playback] Erro:', error)
    let refunded = false
    if (charged) {
      try {
        await addStudioCreditTransaction({
          composerId: composer.composerId,
          projectId,
          action: 'stem_separation_refund',
          amount: STUDIO_MUSIC_CREDITS,
          description: 'Estorno — não foi possível criar o playback',
          metadata: { requestId, feature: 'playback', reason: error?.message || 'provider_failure' },
        })
        refunded = true
      } catch (refundError) {
        console.error('[Studio Playback] Falha ao estornar créditos:', refundError)
      }
    }
    return NextResponse.json({
      error: charged
        ? 'Não conseguimos criar o playback agora.'
        : (error?.message || 'Erro ao criar playback.'),
      creditsRefunded: refunded ? STUDIO_MUSIC_CREDITS : 0,
    }, { status: 500 })
  }
}
