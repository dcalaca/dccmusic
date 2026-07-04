import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import * as auth from '@/lib/site-user-auth'

// POST - Resetar senha do usuário para "123"
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const { id } = params

    await auth.resetUserPassword(id)

    return NextResponse.json({
      success: true,
      message: 'Senha resetada para "123" com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao resetar senha:', error)
    return NextResponse.json(
      { error: 'Erro ao resetar senha', details: error.message },
      { status: 500 }
    )
  }
}
