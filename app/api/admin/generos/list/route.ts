import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const genres = await db.getAllGenres()

    return NextResponse.json(
      genres.map((g) => ({
        id: g.id,
        name: g.name,
      }))
    )
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar gêneros' }, { status: 500 })
  }
}
