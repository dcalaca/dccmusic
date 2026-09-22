import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getComposerEmailLanguage, sendComposerVerificationEmail } from '@/lib/composer-email-verification'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ error: 'Informe o e-mail.' }, { status: 400 })
    }

    const { data: composer, error } = await supabaseAdmin
      .from('dccmusic_composers')
    .select('id, name, email, country, email_verified')
      .eq('email', email)
      .maybeSingle()

    if (error) throw error

    // Não revelar se o e-mail existe ou não.
    if (!composer || composer.email_verified) {
      return NextResponse.json({
        success: true,
        message: 'Se houver uma conta pendente para esse e-mail, enviaremos um novo link de confirmação.',
      })
    }

    await sendComposerVerificationEmail({
      composerId: composer.id,
      email: composer.email,
      name: composer.name,
      language: getComposerEmailLanguage(composer.country),
    })

    return NextResponse.json({
      success: true,
      message: getComposerEmailLanguage(composer.country) === 'en'
        ? 'We sent a new confirmation link to your email.'
        : getComposerEmailLanguage(composer.country) === 'es'
          ? 'Enviamos un nuevo enlace de confirmación a tu correo.'
          : 'Enviamos um novo link de confirmação para seu e-mail.',
    })
  } catch (error: any) {
    console.error('[EMAIL VERIFY] Erro ao reenviar:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao reenviar confirmação' },
      { status: 500 }
    )
  }
}
