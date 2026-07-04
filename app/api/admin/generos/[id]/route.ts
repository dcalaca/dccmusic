import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Buscar gênero por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const genre = await db.getGenreById(id)
    return NextResponse.json(genre)
  } catch (error: any) {
    console.error('Erro ao buscar gênero:', error)
    return NextResponse.json(
      { error: 'Gênero não encontrado', details: error.message },
      { status: 404 }
    )
  }
}

// PUT - Atualizar gênero
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
    const { name, color, icon } = body

    const updateData: any = {}
    
    if (name !== undefined) {
      updateData.name = name.trim()
      // Gerar novo slug se o nome mudou
      updateData.slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
    
    if (color !== undefined) updateData.color = color || null
    if (icon !== undefined) updateData.icon = icon || null

    const genre = await db.updateGenre(id, updateData)
    return NextResponse.json(genre)
  } catch (error: any) {
    console.error('Erro ao atualizar gênero:', error)
    
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Já existe um gênero com este nome' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar gênero', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Deletar gênero
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    
    // Verificar se há músicas ou vídeos usando este gênero
    const genre = await db.getGenreById(id)
    
    const { count: videosCount } = await supabaseAdmin
      .from('dccmusic_videos')
      .select('id', { count: 'exact', head: true })
      .eq('genre', genre.name)
    
    const { count: musicsCount } = await supabaseAdmin
      .from('dccmusic_musics')
      .select('id', { count: 'exact', head: true })
      .eq('genre', genre.name)
    
    if ((videosCount || 0) > 0 || (musicsCount || 0) > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível deletar este gênero pois existem músicas ou vídeos usando ele',
          videosCount: videosCount || 0,
          musicsCount: musicsCount || 0,
        },
        { status: 400 }
      )
    }

    await db.deleteGenre(id)
    return NextResponse.json({ message: 'Gênero deletado com sucesso' })
  } catch (error: any) {
    console.error('Erro ao deletar gênero:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar gênero', details: error.message },
      { status: 500 }
    )
  }
}
