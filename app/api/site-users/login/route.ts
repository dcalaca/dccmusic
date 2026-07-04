import { NextRequest, NextResponse } from 'next/server'
import * as auth from '@/lib/site-user-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await auth.loginSiteUser(email, password)

    return NextResponse.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        firstName: result.user.firstName,
      },
      requiresPasswordChange: result.requiresPasswordChange || false,
    })
  } catch (error: any) {
    console.error('Erro ao fazer login:', error)
    return NextResponse.json(
      { error: error.message || 'Email ou senha incorretos' },
      { status: 401 }
    )
  }
}
