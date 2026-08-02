import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { downloadStudioAudioBuffer } from '@/lib/studio-audio-backup'
import { ensureStemMp3Buffer } from '@/lib/studio-stems'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Proxy same-origin dos stems.
 * O browser não consegue fetch direto em URL assinada/pública do R2 por CORS.
 * WAV antigo é convertido para MP3 sob demanda.
 */
export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const jobId = String(request.nextUrl.searchParams.get('jobId') || '').trim()
    const stemId = String(request.nextUrl.searchParams.get('stemId') || '').trim()
    if (!jobId || !stemId) {
      return NextResponse.json({ error: 'jobId e stemId são obrigatórios.' }, { status: 400 })
    }

    const { data: job, error } = await supabaseAdmin
      .from('studio_stem_jobs')
      .select('id, composer_id, stems')
      .eq('id', jobId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!job) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })

    const stems = Array.isArray(job.stems) ? job.stems : []
    const stem = stems.find((item: any) => item?.id === stemId)
    if (!stem?.path) {
      return NextResponse.json({ error: 'Stem não encontrado.' }, { status: 404 })
    }

    const downloaded = await downloadStudioAudioBuffer(stem.path, stem.storage_provider || 'r2')
    if (!downloaded) {
      return NextResponse.json({ error: 'Áudio indisponível.' }, { status: 404 })
    }

    const prepared = await ensureStemMp3Buffer({
      buffer: downloaded.buffer,
      fileName: String(stem.path),
      contentType: downloaded.contentType,
    })

    return new NextResponse(new Uint8Array(prepared.buffer), {
      status: 200,
      headers: {
        'Content-Type': prepared.contentType,
        'Content-Length': String(prepared.buffer.byteLength),
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error: any) {
    console.error('[Studio Stems] file proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar áudio do stem' },
      { status: 500 }
    )
  }
}
