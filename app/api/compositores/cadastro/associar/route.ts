import { NextResponse } from 'next/server'
import * as composerAuth from '@/lib/composer-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, composerName, composerId } = body

    if (!email || !password || !composerName) {
      return NextResponse.json(
        { error: 'Email, senha e nome do compositor são obrigatórios' },
        { status: 400 }
      )
    }

    if (!composerId) {
      return NextResponse.json(
        { error: 'ID do compositor é obrigatório' },
        { status: 400 }
      )
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    const result = await composerAuth.associateAccountToComposer(
      composerId,
      email,
      password,
      composerName
    )

    let message = 'Conta associada ao compositor existente com sucesso! Você já pode fazer login.'
    
    if (result.previousName && result.previousName !== result.composer.name) {
      message = `Conta associada ao compositor existente "${result.previousName}" com sucesso! O nome foi atualizado para "${result.composer.name}". Você já pode fazer login.`
    }

    return NextResponse.json({
      success: true,
      composer: {
        id: result.composer.id,
        name: result.composer.name,
        slug: result.composer.slug,
        email: email,
      },
      message,
    })
  } catch (error: any) {
    console.error('Erro ao associar conta:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao associar conta' },
      { status: 500 }
    )
  }
}
