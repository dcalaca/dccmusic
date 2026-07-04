import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

// Evita cache estático no build: a lista precisa refletir novos gêneros na hora.
export const dynamic = 'force-dynamic'

// API pública para listar gêneros (usada por compositores e páginas públicas)
export async function GET() {
  try {
    const genres = await db.getAllGenres()

    return NextResponse.json(
      genres.map((g) => ({
        id: g.id,
        name: g.name,
      }))
    )
  } catch (error) {
    console.error('Erro ao buscar gêneros:', error)
    return NextResponse.json({ error: 'Erro ao buscar gêneros' }, { status: 500 })
  }
}
