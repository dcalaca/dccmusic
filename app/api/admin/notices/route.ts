import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const NOTICE_ID = '00000000-0000-0000-0000-000000000001'

function isMissingNoticeTable(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('site_notices') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

function mapNotice(row: any) {
  if (!row) {
    return {
      id: NOTICE_ID,
      title: '',
      message: '',
      isActive: false,
      createdAt: null,
      updatedAt: null,
    }
  }

  return {
    id: row.id,
    title: row.title || '',
    message: row.message || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function GET() {
  try {
    await requireAuth()

    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .select('*')
      .eq('id', NOTICE_ID)
      .maybeSingle()

    if (error) {
      if (isMissingNoticeTable(error)) {
        return NextResponse.json({
          notice: mapNotice(null),
          setupRequired: true,
          setupSqlFile: 'SQL-CRIAR-QUADRO-AVISOS.sql',
        })
      }
      throw error
    }

    return NextResponse.json({ notice: mapNotice(data), setupRequired: false })
  } catch (error: any) {
    console.error('[Admin Notices] Erro ao carregar aviso:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar quadro de avisos' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const isActive = Boolean(body.isActive)

    if (isActive && (!title || !message)) {
      return NextResponse.json(
        { error: 'Preencha título e mensagem antes de ativar o aviso.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .upsert({
        id: NOTICE_ID,
        title,
        message,
        is_active: isActive,
        updated_at: now,
      }, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) {
      if (isMissingNoticeTable(error)) {
        return NextResponse.json(
          {
            error: 'A tabela do quadro de avisos ainda não existe. Execute o arquivo SQL-CRIAR-QUADRO-AVISOS.sql no Supabase.',
          },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ notice: mapNotice(data) })
  } catch (error: any) {
    console.error('[Admin Notices] Erro ao salvar aviso:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar quadro de avisos' },
      { status: 500 }
    )
  }
}
