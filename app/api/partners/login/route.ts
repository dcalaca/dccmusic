import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { isPartnerSchemaMissing, signPartnerToken } from '@/lib/partners'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
    }

    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('id, email, display_name, password_hash, requires_password_change, is_active')
      .eq('email', email)
      .maybeSingle()

    if (error) throw error
    if (!partner || partner.is_active === false || !partner.password_hash) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, partner.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const token = signPartnerToken({
      partnerId: partner.id,
      email: partner.email,
      displayName: partner.display_name,
      requiresPasswordChange: Boolean(partner.requires_password_change),
    })

    return NextResponse.json({
      success: true,
      token,
      requiresPasswordChange: Boolean(partner.requires_password_change),
      partner: {
        id: partner.id,
        email: partner.email,
        displayName: partner.display_name,
      },
    })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, error: 'Sistema de parceiros ainda não configurado.' }, { status: 400 })
    }
    console.error('[Partner Login] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao entrar' }, { status: 500 })
  }
}

