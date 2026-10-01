import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = String(searchParams.get('email') || '').trim()

    if (!email) {
      return NextResponse.json({ error: 'Informe o e-mail do usuário.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ composer: data })
  } catch (error: any) {
    console.error('Erro ao localizar compositor por e-mail:', error)
    return NextResponse.json(
      { error: 'Erro ao localizar usuário', details: error.message },
      { status: 500 }
    )
  }
}
