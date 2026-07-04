import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { slugify } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, slug, genre, spotifyUrl, spotifyEmbed, tags, description, coverUrl, featured, publishedAt, composers } = body

    if (!title || !slug || !genre) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Normalizar strings vazias para null
    const normalizeString = (value: any) => {
      if (value === undefined) return undefined
      if (typeof value === 'string' && value.trim() === '') return null
      return value || null
    }

    const music = await db.updateMusic(params.id, {
      title: title.trim(),
      slug: slugify(slug),
      genre: normalizeString(genre),
      spotifyUrl: normalizeString(spotifyUrl),
      spotifyEmbed: normalizeString(spotifyEmbed),
      appleMusicUrl: null,
      appleMusicEmbed: null,
      tags: normalizeString(tags),
      description: normalizeString(description),
      coverUrl: normalizeString(coverUrl),
      featured: featured !== undefined ? featured : undefined,
      publishedAt: new Date(publishedAt),
      composers: composers || [],
    })

    // Invalidar cache da página pública da música
    try {
      revalidatePath(`/musicas/${music.slug}`)
      revalidatePath('/musicas')
    } catch (error) {
      // Ignorar erros de revalidação em produção
      console.log('Erro ao invalidar cache:', error)
    }

    return NextResponse.json(music)
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Música não encontrada' }, { status: 404 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Música com este slug já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar música' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await db.deleteMusic(params.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Música não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao excluir música' }, { status: 500 })
  }
}
