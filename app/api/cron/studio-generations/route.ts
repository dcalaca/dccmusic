import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import {
  extractMurekaChoicesFromPayload,
  saveMurekaGenerationTracksEnsuringTwo,
} from '@/lib/studio-mureka-versions'
import {
  isStudioGenerationTimedOut,
  markStudioGenerationAsCommunicationFailure,
  releaseStudioProjectFromFailedGeneration,
  STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
} from '@/lib/studio-generation-timeout'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function notifyMusicReady(generation: any) {
  const [{ data: project }, composer] = await Promise.all([
    supabaseAdmin
      .from('studio_projects')
      .select('id, title')
      .eq('id', generation.project_id)
      .maybeSingle(),
    getComposerEmailIdentity(generation.composer_id),
  ])

  if (project && composer) {
    await sendStudioMusicReadyEmail({
      ...composer,
      projectId: project.id,
      projectTitle: project.title || 'Sua música',
    }).catch((emailError) => {
      console.error('[CRON STUDIO GENERATIONS] Erro ao enviar e-mail:', emailError)
    })
  }
}

async function saveMurekaResult(generation: any, result: any) {
  const choices = extractMurekaChoicesFromPayload(result)
  const { savedVersions, hasExactTwo } = await saveMurekaGenerationTracksEnsuringTwo({
    generation,
    choices,
    isComplete: true,
    model: result?.model || result?.data?.model || null,
  })

  if (savedVersions.length === 0) {
    await supabaseAdmin
      .from('studio_generations')
      .update({
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id)
    return false
  }

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice
  const fullyReady = hasExactTwo

  const [{ error: generationError }, { error: projectError }] = await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: fullyReady ? 'completed' : 'first_ready',
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({
        status: fullyReady ? 'ready' : 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.project_id),
  ])

  if (generationError) throw generationError
  if (projectError) throw projectError

  if (!fullyReady) {
    console.warn('[CRON STUDIO GENERATIONS] Mureka succeeded sem 2 versões; mantendo generating', {
      generationId: generation.id,
      saved: savedVersions.length,
    })
    return false
  }

  const { data: project } = await supabaseAdmin
    .from('studio_projects')
    .select('id, title, style, mood, description')
    .eq('id', generation.project_id)
    .maybeSingle()

  if (project) {
    await ensureSimpleStudioCover({
      projectId: project.id,
      composerId: generation.composer_id,
      title: project.title || 'Sua música',
      style: project.style,
      mood: project.mood,
      description: project.description,
      replaceCurrent: true,
    }).catch((coverError) => {
      console.error('[CRON STUDIO GENERATIONS] Erro ao criar capa simples:', coverError)
    })
  }

  if (generation.status !== 'completed') {
    await notifyMusicReady(generation)
  }
  return true
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!process.env.MUREKA_API_KEY) {
      return NextResponse.json({ success: true, checked: 0, completed: 0, skipped: 'MUREKA_API_KEY ausente' })
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentGenerations, error } = await supabaseAdmin
      .from('studio_generations')
      .select('*')
      .not('provider_task_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error
    const generations = (recentGenerations || []).filter((generation: any) => (
      generation.provider === 'mureka' &&
      ['pending', 'processing', 'first_ready'].includes(generation.status)
    ))

    let completed = 0
    const errors: string[] = []

    for (const generation of generations || []) {
      try {
        if (isStudioGenerationTimedOut(generation)) {
          const { data: generationVersion } = await supabaseAdmin
            .from('studio_versions')
            .select('id, audio_url, stream_audio_url')
            .eq('generation_id', generation.id)
            .limit(1)
            .maybeSingle()

          if (!generationVersion?.audio_url && !generationVersion?.stream_audio_url) {
            await markStudioGenerationAsCommunicationFailure(generation)
            continue
          }
        }

        const response = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(generation.provider_task_id)}`, {
          headers: {
            Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
          },
        })
        const result = await response.json().catch(() => null)
        const status = result?.status || result?.data?.status

        if (status === 'succeeded') {
          const saved = await saveMurekaResult(generation, result)
          if (saved) completed += 1
        } else if (['failed', 'timeouted', 'cancelled'].includes(status)) {
          await supabaseAdmin
            .from('studio_generations')
            .update({
              status: 'failed',
              error_message: STUDIO_MUSIC_GENERATION_COMMUNICATION_ERROR,
              response_payload: result,
              updated_at: new Date().toISOString(),
            })
            .eq('id', generation.id)
          await releaseStudioProjectFromFailedGeneration(generation.project_id)
        } else if (result) {
          await supabaseAdmin
            .from('studio_generations')
            .update({
              response_payload: result,
              updated_at: new Date().toISOString(),
            })
            .eq('id', generation.id)
        }
      } catch (error: any) {
        errors.push(`${generation.id}: ${error?.message || 'erro desconhecido'}`)
      }
    }

    return NextResponse.json({
      success: true,
      checked: generations?.length || 0,
      scanned: recentGenerations?.length || 0,
      completed,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON STUDIO GENERATIONS] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro no cron' }, { status: 500 })
  }
}
