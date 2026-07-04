import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import * as composerAuth from '@/lib/composer-auth'

// POST - Resetar senha do compositor para "123"
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const { id } = params

    await composerAuth.resetComposerPassword(id)

    return NextResponse.json({
      success: true,
      message: 'Senha resetada para "123" com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao resetar senha do compositor:', error)
    return NextResponse.json(
      { error: 'Erro ao resetar senha', details: error.message },
      { status: 500 }
    )
  }
}
