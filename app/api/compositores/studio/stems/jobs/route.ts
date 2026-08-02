import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Lista separações salvas do compositor (para reabrir no mixer). */
export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('studio_stem_jobs')
      .select('id, source_title, status, provider, project_id, stems, created_at, updated_at, error')
      .eq('composer_id', composer.composerId)
      .in('status', ['ready', 'processing', 'failed'])
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    const jobs = (data || []).map((job) => {
      const stems = Array.isArray(job.stems) ? job.stems : []
      return {
        id: job.id,
        title: job.source_title || 'Separação sem título',
        status: job.status,
        provider: job.provider,
        projectId: job.project_id,
        stemCount: stems.length,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }
    })

    return NextResponse.json({ jobs })
  } catch (error: any) {
    console.error('[Studio Stems] list jobs error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar separações' },
      { status: 500 }
    )
  }
}
