import { NextRequest, NextResponse } from 'next/server'
import * as auth from '@/lib/site-user-auth'

// POST - Trocar senha do usuário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token e nova senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar token
    const decoded = auth.verifySiteUserToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    // Atualizar senha
    await auth.updateUserPassword(decoded.userId, newPassword)

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao trocar senha:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao trocar senha' },
      { status: 500 }
    )
  }
}
