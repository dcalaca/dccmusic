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
    const { title, slug, youtubeUrl, youtubeId, youtubeEmbed, genre, tags, description, publishedAt, featured, thumbnailUrl, duration, composers } = body

    if (!title || !slug || !youtubeId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando: título, slug e YouTube ID são obrigatórios' }, { status: 400 })
    }

    const video = await db.createVideo({
      title,
      slug: slugify(slug),
      youtubeUrl,
      youtubeId,
      youtubeEmbed: youtubeEmbed || null,
      genre: (genre && genre.trim()) ? genre.trim() : null,
      tags: tags || null,
      description: description || null,
      publishedAt: new Date(publishedAt),
      featured: featured || false,
      thumbnailUrl: thumbnailUrl || null,
      duration: duration || null,
      composers: composers || [],
    })

    return NextResponse.json(video)
  } catch (error: any) {
    console.error('[API] Erro ao criar vídeo:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Vídeo com este slug já existe' }, { status: 400 })
    }
    if (error.code === '42703' || error.message?.includes('youtube_embed')) {
      return NextResponse.json({ 
        error: 'Coluna youtube_embed não existe no banco. Execute o SQL-ADICIONAR-YOUTUBE-EMBED.sql no Supabase.' 
      }, { status: 500 })
    }
    if (error.code === '23502' || error.message?.includes('genre_id') || error.message?.includes('violates not-null constraint')) {
      return NextResponse.json({ 
        error: 'Erro de constraint no banco. Execute o SQL-REMOVER-CONSTRAINTS-GENRE-ID.sql no Supabase para corrigir.',
        details: error.message
      }, { status: 500 })
    }
    return NextResponse.json({ 
      error: error.message || 'Erro ao criar vídeo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
