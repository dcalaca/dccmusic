import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { getSiteUserFromRequest } from '@/lib/site-user-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = getSiteUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const stats = await db.getUserStats(user.userId)

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
