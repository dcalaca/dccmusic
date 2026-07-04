import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

// PUT - Liberar ou revogar acesso de um compositor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { action, durationYears } = body

    if (action === 'grant') {
      await db.grantFreeAccessToComposer(id, durationYears || 10)
      return NextResponse.json({ 
        message: 'Acesso liberado com sucesso',
        success: true 
      })
    } else if (action === 'revoke') {
      await db.revokeComposerAccess(id)
      return NextResponse.json({ 
        message: 'Acesso revogado com sucesso',
        success: true 
      })
    } else {
      return NextResponse.json(
        { error: 'Ação inválida. Use "grant" ou "revoke"' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Erro ao atualizar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar assinatura', details: error.message },
      { status: 500 }
    )
  }
}
