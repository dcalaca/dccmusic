import { NextResponse } from 'next/server'
import * as composerAuth from '@/lib/composer-auth'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    console.log('[LOGIN-API] Tentativa de login recebida:', { email: email?.substring(0, 5) + '***' })

    if (!email || !password) {
      console.log('[LOGIN-API] Campos obrigatórios faltando')
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await composerAuth.loginComposer(email, password)
    console.log('[LOGIN-API] Login bem-sucedido para:', result.composer.email)

    // Criar token JWT
    const token = jwt.sign(
      {
        composerId: result.composer.id,
        email: email,
        name: result.composer.name,
        requiresPasswordChange: result.requiresPasswordChange || false,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token,
      composer: {
        id: result.composer.id,
        name: result.composer.name,
        slug: result.composer.slug,
        email: email,
        isPremium: result.composer.isPremium,
        subscription_expires_at: result.composer.subscriptionExpiresAt,
      },
      requiresPasswordChange: result.requiresPasswordChange || false,
    })
  } catch (error: any) {
    console.error('[LOGIN-API] Erro ao fazer login:', {
      message: error.message,
      code: error.code,
      details: error.details
    })
    return NextResponse.json(
      {
        error: error.message || 'Erro ao fazer login',
        code: error.code || null,
        email: error.email || null,
      },
      { status: 401 }
    )
  }
}
