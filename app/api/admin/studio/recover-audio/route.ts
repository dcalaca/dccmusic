import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioCallback } from '@/lib/studio'
import { fetchSunoTaskTracks, saveSunoGenerationTracksEnsuringTwo } from '@/lib/studio-suno-versions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Recuperação manual e pontual de áudios já concluídos no fornecedor. */
export async function POST(request: NextRequest) {
  if (!isValidStudioCallback(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const taskIds = [...new Set((Array.isArray(body?.taskIds) ? body.taskIds : [])
    .map((value: unknown) => String(value || '').trim())
    .filter(Boolean))]
    .slice(0, 30)

  if (!taskIds.length) {
    return NextResponse.json({ error: 'Informe os taskIds para recuperar.' }, { status: 400 })
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
