import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest, resolveComposerToken } from '@/lib/composer-middleware'
import { getProjectForComposer } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TRANSFER_ADMIN_EMAIL = 'dcalaca@gmail.com'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const composerToken = getComposerFromRequest(request)
    if (!composerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const sourceComposer = await resolveComposerToken(composerToken)
    if (!sourceComposer) return NextResponse.json({ error: 'Sessão do compositor não encontrada' }, { status: 401 })
    if (sourceComposer.email.trim().toLowerCase() !== TRANSFER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'A transferência de projetos é permitida apenas para a conta administradora.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const recipientEmail = String(body?.recipientEmail || '').trim().toLowerCase()
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido para o compositor que vai receber.' }, { status: 400 })
    }

    const project = await getProjectForComposer(params.id, sourceComposer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado na sua conta.' }, { status: 404 })

    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .ilike('email', recipientEmail)
      .limit(1)
      .maybeSingle()

    if (recipientError) throw recipientError
    if (!recipient) {
      return NextResponse.json({ error: 'Não encontrei um compositor cadastrado com esse e-mail. Peça para ele criar a conta gratuita primeiro.' }, { status: 404 })
    }
    if (recipient.id === sourceComposer.composerId) {
      return NextResponse.json({ error: 'Esse projeto já está na sua conta.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('transfer_studio_project', {
      p_project_id: params.id,
      p_from_composer_id: sourceComposer.composerId,
      p_to_composer_id: recipient.id,
    })
    if (error) throw error

    return NextResponse.json({
      success: true,
      project: data?.[0] || { id: project.id, title: project.title },
      recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro transferir projeto:', error)
    return NextResponse.json({ error: error.message || 'Não foi possível transferir o projeto.' }, { status: 500 })
  }
}
