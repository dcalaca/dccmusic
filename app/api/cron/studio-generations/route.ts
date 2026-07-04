import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getComposerEmailIdentity,
  sendStudioMusicReadyEmail,
} from '@/lib/dcc-emails'
import { ensureSimpleStudioCover } from '@/lib/studio-simple-cover'
import { backupStudioVersionAudio } from '@/lib/studio-audio-backup'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function getMurekaChoices(result: any) {
  const choices = result?.choices || result?.data?.choices
  return Array.isArray(choices) ? choices : []
}

function normalizeDurationSeconds(value: any) {
  const duration = Number(value) || 0
  if (!duration) return null
  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)
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

async function backupVersionAudio(versionId: string | null | undefined, generation: any, audioUrl: string | null, streamAudioUrl: string | null) {
  if (!versionId) return
  await backupStudioVersionAudio({
    versionId,
    composerId: generation.composer_id,
    audioUrl,
    streamAudioUrl,
  }).catch((backupError) => {
    console.error('[CRON STUDIO GENERATIONS] Erro no backup interno do áudio:', backupError)
  })
}

async function saveMurekaResult(generation: any, result: any) {
  const choices = getMurekaChoices(result)
  const validChoices = choices.filter((choice: any) => (
    choice?.url || choice?.audio_url || choice?.stream_url || choice?.streamAudioUrl
  ))

  if (validChoices.length === 0) {
    await supabaseAdmin
      .from('studio_generations')
      .update({
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id)
    return false
  }

  await supabaseAdmin
    .from('studio_versions')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('project_id', generation.project_id)
    .eq('composer_id', generation.composer_id)

  const { data: existingVersions } = await supabaseAdmin
    .from('studio_versions')
    .select('id, audio_url, stream_audio_url, provider_payload')
    .eq('generation_id', generation.id)

  const savedVersions: Array<{ id: string | null; choice: any }> = []

  for (const [index, choice] of validChoices.entries()) {
    const audioUrl = choice.url || choice.audio_url || null
    const streamAudioUrl = choice.stream_url || choice.streamAudioUrl || audioUrl
    const isCurrent = index === validChoices.length - 1
    const matchingVersion = (existingVersions || []).find((version: any) => (
      (choice?.id && version.provider_payload?.id === choice.id) ||
      (audioUrl && version.audio_url === audioUrl) ||
      (streamAudioUrl && version.stream_audio_url === streamAudioUrl)
    ))

    const versionPayload = {
      audio_url: audioUrl,
      stream_audio_url: streamAudioUrl,
      duration: normalizeDurationSeconds(choice.duration),
      model: result?.model || result?.data?.model || null,
      provider_payload: choice,
      is_current: isCurrent,
      updated_at: new Date().toISOString(),
    }

    let savedVersionId = matchingVersion?.id || null

    if (matchingVersion) {
      const { error } = await supabaseAdmin
        .from('studio_versions')
        .update(versionPayload)
        .eq('id', matchingVersion.id)
      if (error) throw error
    } else {
      const { data: insertedVersion, error } = await supabaseAdmin
        .from('studio_versions')
        .insert({
          project_id: generation.project_id,
          composer_id: generation.composer_id,
          generation_id: generation.id,
          version_name: validChoices.length > 1 ? `Música gerada #${index + 1}` : 'Versão IA',
          style: generation.request_payload?.prompt || null,
          ...versionPayload,
        })
        .select('id')
        .maybeSingle()
      if (error) throw error
      savedVersionId = insertedVersion?.id || savedVersionId
    }

    await backupVersionAudio(savedVersionId, generation, audioUrl, streamAudioUrl)
    savedVersions.push({ id: savedVersionId, choice })
  }

  const currentChoice = savedVersions[savedVersions.length - 1]?.choice

  const [{ error: generationError }, { error: projectError }] = await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .update({
        provider_audio_id: currentChoice?.id || null,
        status: 'completed',
        response_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation.id),
    supabaseAdmin
      .from('studio_projects')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', generation.project_id),
  ])

  if (generationError) throw generationError
  if (projectError) throw projectError

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

  await notifyMusicReady(generation)
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
              error_message: result?.failed_reason || result?.data?.failed_reason || status,
              response_payload: result,
              updated_at: new Date().toISOString(),
            })
            .eq('id', generation.id)
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
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar gerações do Studio IA' },
      { status: 500 }
    )
  }
}
