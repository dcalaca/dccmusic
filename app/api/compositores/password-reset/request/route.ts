import { NextResponse } from 'next/server'
import { sendComposerPasswordResetEmail } from '@/lib/composer-password-reset'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (!email) {
      return NextResponse.json(
        { error: 'Informe seu e-mail' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      )
    }

    await sendComposerPasswordResetEmail(email)

    return NextResponse.json({
      success: true,
      message: 'Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.',
    })
  } catch (error: any) {
    console.error('[PASSWORD RESET REQUEST] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao solicitar redefinição de senha' },
      { status: 500 }
    )
  }
}
