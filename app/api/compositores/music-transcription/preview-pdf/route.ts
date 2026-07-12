import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { createSimpleTextPdf } from '@/lib/simple-text-pdf'

export const dynamic = 'force-dynamic'

function normalizeFilename(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'letra-cifra'

  return `${base}-letra-cifra.pdf`
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim()
    if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

    const { data: row, error } = await supabaseAdmin
      .from('music_transcriptions')
      .select('id, composer_id, title, preview_text')
      .eq('id', id)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!row) return NextResponse.json({ error: 'Transcrição não encontrada.' }, { status: 404 })
    if (!row.preview_text) return NextResponse.json({ error: 'Prévia de letra e cifra não encontrada.' }, { status: 404 })

    const buffer = createSimpleTextPdf({
      title: row.title || 'Letra e cifra',
      text: row.preview_text,
    })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${normalizeFilename(row.title || 'letra-cifra')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[Music Transcription] Erro gerar PDF da prévia:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar PDF da prévia.' },
      { status: 500 }
    )
  }
}
