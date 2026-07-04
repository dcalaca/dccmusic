import { NextRequest, NextResponse } from 'next/server'
import * as composerAuth from '@/lib/composer-auth'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// POST - Trocar senha do compositor
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
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    if (!decoded.composerId) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Atualizar senha
    await composerAuth.updateComposerPassword(decoded.composerId, newPassword)

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao trocar senha do compositor:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao trocar senha' },
      { status: 500 }
    )
  }
}
