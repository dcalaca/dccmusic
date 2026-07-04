import { NextRequest, NextResponse } from 'next/server'
import * as auth from '@/lib/site-user-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await auth.registerSiteUser(name, email, password)

    return NextResponse.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        firstName: result.user.firstName,
      },
    })
  } catch (error: any) {
    console.error('Erro ao registrar usuário:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao registrar usuário' },
      { status: 400 }
    )
  }
}
