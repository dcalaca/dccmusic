import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getComposerEmailLanguage, sendComposerVerificationEmail } from '@/lib/composer-email-verification'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ errorCode: 'emailRequired' }, { status: 400 })
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
        messageCode: 'verificationResendAccepted',
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
      messageCode: 'verificationSent',
    })
  } catch (error) {
    console.error('[EMAIL VERIFY] Erro ao reenviar:', error)
    return NextResponse.json(
      { errorCode: 'resendVerificationFailed' },
      { status: 500 }
    )
  }
}
