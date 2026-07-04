import { NextResponse } from 'next/server'
import { resetComposerPasswordWithToken } from '@/lib/composer-password-reset'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token e nova senha são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await resetComposerPasswordWithToken(token, newPassword)

    if (!result.ok) {
      const message = result.reason === 'expired'
        ? 'Este link expirou. Solicite um novo link de redefinição de senha.'
        : 'Este link é inválido ou já foi usado. Solicite um novo link.'

      return NextResponse.json(
        { error: message, reason: result.reason },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Senha criada com sucesso. Faça login com sua nova senha.',
    })
  } catch (error: any) {
    console.error('[PASSWORD RESET CONFIRM] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar nova senha' },
      { status: 500 }
    )
  }
}
