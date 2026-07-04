import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { slugify } from '@/lib/utils'

export async function POST(request: NextRequest) {
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

    const music = await db.createMusic({
      title,
      slug: slugify(slug),
      genre: genre || null,
      spotifyUrl: spotifyUrl || null,
      spotifyEmbed: spotifyEmbed || null,
      appleMusicUrl: null,
      appleMusicEmbed: null,
      tags: tags || null,
      description: description || null,
      coverUrl: coverUrl || null,
      featured: featured || false,
      publishedAt: new Date(publishedAt),
      composers: composers || [],
    })

    return NextResponse.json(music)
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Música com este slug já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar música' }, { status: 500 })
  }
}
