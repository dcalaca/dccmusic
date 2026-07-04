import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { slugify } from '@/lib/utils'

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
    const { title, slug, youtubeUrl, youtubeId, youtubeEmbed, genre, tags, description, publishedAt, featured, thumbnailUrl, duration, composers } = body

    if (!title || !slug || !youtubeId || !genre) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const video = await db.updateVideo(params.id, {
      title,
      slug: slugify(slug),
      youtubeUrl,
      youtubeId,
      youtubeEmbed: youtubeEmbed || null,
      genre: genre || null,
      tags: tags || null,
      description: description || null,
      publishedAt: new Date(publishedAt),
      featured: featured !== undefined ? featured : undefined,
      thumbnailUrl: thumbnailUrl || null,
      duration: duration || null,
      composers: composers || [],
    })

    return NextResponse.json(video)
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Vídeo com este slug já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar vídeo' }, { status: 500 })
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

    await db.deleteVideo(params.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao excluir vídeo' }, { status: 500 })
  }
}
