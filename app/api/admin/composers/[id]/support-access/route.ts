import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const composer = await db.getComposerById(params.id)
    if (!composer) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    const token = jwt.sign(
      {
        composerId: composer.id,
        email: composer.email || '',
        name: composer.name,
        supportAccess: true,
      },
      JWT_SECRET,
      { expiresIn: '60m' }
    )

    return NextResponse.json({
      success: true,
      token,
      composer: {
        id: composer.id,
        name: composer.name,
        slug: composer.slug,
        email: composer.email || '',
        isPremium: Boolean(composer.isPremium),
        subscription_expires_at: composer.subscriptionExpiresAt || null,
        supportAccess: true,
      },
      expiresInMinutes: 60,
    })
  } catch (error: any) {
    console.error('[ADMIN SUPPORT ACCESS] Erro ao gerar acesso:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar acesso de suporte', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
