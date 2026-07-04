import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

// GET - Listar todos os gêneros
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const genres = await db.getAllGenres()
    return NextResponse.json(genres)
  } catch (error: any) {
    console.error('Erro ao buscar gêneros:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar gêneros', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Criar novo gênero
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, icon } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Nome do gênero é obrigatório' },
        { status: 400 }
      )
    }

    // Gerar slug automaticamente
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const genre = await db.createGenre({
      name: name.trim(),
      slug,
      color: color || null,
      icon: icon || null,
    })

    return NextResponse.json(genre, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar gênero:', error)
    
    // Verificar se é erro de duplicata
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Já existe um gênero com este nome' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar gênero', details: error.message },
      { status: 500 }
    )
  }
}
