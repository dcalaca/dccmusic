import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { readTranscriptionBinaryFile } from '@/lib/music-transcription-storage'

export const dynamic = 'force-dynamic'

function normalizeFilename(value: string, extension: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'transcricao'

  return `${base}.${extension}`
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim()
    const kind = searchParams.get('kind') === 'musicxml'
      ? 'musicxml'
      : searchParams.get('kind') === 'zip'
        ? 'zip'
        : 'pdf'

    if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

    const { data: row, error } = await supabaseAdmin
      .from('music_transcriptions')
      .select('*')
      .eq('id', id)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!row) return NextResponse.json({ error: 'Transcrição não encontrada.' }, { status: 404 })

    const path = kind === 'musicxml' ? row.musicxml_path : kind === 'zip' ? row.zip_path : row.pdf_path
    if (!path) return NextResponse.json({ error: 'Arquivo não encontrado para esta transcrição.' }, { status: 404 })

    const buffer = await readTranscriptionBinaryFile(path)
    const extension = kind === 'musicxml' ? 'musicxml' : kind
    const contentType = kind === 'musicxml'
      ? 'application/vnd.recordare.musicxml+xml'
      : kind === 'zip'
        ? 'application/zip'
        : 'application/pdf'
    const disposition = kind === 'pdf' ? 'inline' : 'attachment'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${normalizeFilename(row.title || 'transcricao', extension)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[Music Transcription] Erro baixar arquivo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao baixar arquivo.' },
      { status: 500 }
    )
  }
}
