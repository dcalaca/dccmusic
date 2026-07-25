import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listAppSettingsForAdmin, upsertAppSetting } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const settings = await listAppSettingsForAdmin()
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('[ADMIN SETTINGS] Erro ao listar:', error)
    const message = String(error?.message || '')
    if (message.includes('app_settings') || error?.code === '42P01') {
      return NextResponse.json(
        {
          error:
            'A tabela de configurações ainda não existe. Execute o SQL database/SQL-APP-SETTINGS.sql no Supabase.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message || 'Erro ao carregar configurações' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const key = String(body.key || '').trim()
    const value = body.value

    if (!key) {
      return NextResponse.json({ error: 'Informe a chave da configuração.' }, { status: 400 })
    }

    const updated = await upsertAppSetting({
      key,
      value,
      updatedBy: session.user?.email || session.user?.name || 'admin',
    })

    const settings = await listAppSettingsForAdmin()
    return NextResponse.json({
      success: true,
      setting: updated,
      settings,
      message: 'Configuração salva com sucesso.',
    })
  } catch (error: any) {
    console.error('[ADMIN SETTINGS] Erro ao salvar:', error)
    const message = String(error?.message || '')
    if (message.includes('app_settings') || error?.code === '42P01') {
      return NextResponse.json(
        {
          error:
            'A tabela de configurações ainda não existe. Execute o SQL database/SQL-APP-SETTINGS.sql no Supabase.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message || 'Erro ao salvar configuração' }, { status: 500 })
  }
}
