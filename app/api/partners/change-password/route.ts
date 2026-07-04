import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getPartnerFromRequest, isPartnerSchemaMissing, signPartnerToken } from '@/lib/partners'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const partnerToken = getPartnerFromRequest(request)
    if (!partnerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const password = String(body?.password || '')

    if (password.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    if (password === '123') {
      return NextResponse.json({ error: 'Escolha uma senha diferente da senha temporária.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { error } = await supabaseAdmin
      .from('partners')
      .update({
        password_hash: passwordHash,
        requires_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partnerToken.partnerId)

    if (error) throw error

    const token = signPartnerToken({
      partnerId: partnerToken.partnerId,
      email: partnerToken.email,
      displayName: partnerToken.displayName,
      requiresPasswordChange: false,
    })

    return NextResponse.json({ success: true, token })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, error: 'Sistema de parceiros ainda não configurado.' }, { status: 400 })
    }
    console.error('[Partner Change Password] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao trocar senha' }, { status: 500 })
  }
}

