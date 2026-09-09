import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { fetchSunoTaskTracks, saveSunoGenerationTracksEnsuringTwo } from '@/lib/studio-suno-versions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Recuperação manual e pontual de áudios já concluídos no fornecedor. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session && !isValidStudioCallback(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  let taskIds = [...new Set((Array.isArray(body?.taskIds) ? body.taskIds : [])
    .map((value: unknown) => String(value || '').trim())
    .filter(Boolean))]
    .slice(0, 30)

  if (!taskIds.length) {
    const { data: affectedVersions, error: versionsError } = await supabaseAdmin
      .from('studio_versions')
      .select('generation_id')
      .in('audio_backup_status', ['failed', 'external_ready'])
      .not('generation_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(60)
    if (versionsError) throw versionsError

    const generationIds = [...new Set((affectedVersions || []).map((version: any) => version.generation_id).filter(Boolean))]
    if (!generationIds.length) {
      return NextResponse.json({ success: true, results: [], message: 'Nenhum áudio pendente de recuperação.' })
    }

    const { data: affectedGenerations, error: generationsError } = await supabaseAdmin
      .from('studio_generations')
      .select('provider_task_id')
      .in('id', generationIds)
      .not('provider_task_id', 'is', null)
    if (generationsError) throw generationsError
    taskIds = [...new Set((affectedGenerations || []).map((generation: any) => generation.provider_task_id).filter(Boolean))].slice(0, 30)
  }

  const { data: generations, error } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .in('provider_task_id', taskIds)

  if (error) throw error

  const results = []
  for (const generation of generations || []) {
    try {
      const tracks = await fetchSunoTaskTracks(generation.provider_task_id)
      const saved = await saveSunoGenerationTracksEnsuringTwo({
        generation,
        tracks,
        isComplete: true,
      })

      const completed = saved.hasExactTwo
      if (completed) {
        await Promise.all([
          supabaseAdmin.from('studio_generations').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', generation.id),
          supabaseAdmin.from('studio_projects').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', generation.project_id),
        ])
      }

      results.push({ taskId: generation.provider_task_id, recovered: completed, versions: saved.savedVersions.length })
    } catch (recoveryError: any) {
      results.push({ taskId: generation.provider_task_id, recovered: false, error: recoveryError?.message || 'Falha na recuperação.' })
    }
  }

  return NextResponse.json({ success: true, results })
}
