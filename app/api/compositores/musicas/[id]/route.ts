import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const musicId = params.id

    // Verificar se a música pertence ao compositor
    const { data: musicComposer } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('composer_id')
      .eq('music_id', musicId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!musicComposer) {
      return NextResponse.json(
        { error: 'Música não encontrada ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Buscar música com compositores
    const music = await db.getMusicById(musicId)
    
    return NextResponse.json({ music })
  } catch (error: any) {
    console.error('Erro ao buscar música:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar música' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const musicId = params.id

    // Verificar se a música pertence ao compositor
    const { data: musicComposer } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('composer_id')
      .eq('music_id', musicId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!musicComposer) {
      return NextResponse.json(
        { error: 'Música não encontrada ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Verificar se compositor tem assinatura ativa
    const hasSubscription = await db.checkComposerHasActiveSubscription(composer.composerId)
    if (!hasSubscription) {
      return NextResponse.json(
        { error: 'Você precisa de uma assinatura ativa para gerenciar músicas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      slug,
      genre,
      spotifyUrl,
      spotifyEmbed,
      appleMusicUrl,
      appleMusicEmbed,
      tags,
      description,
      publishedAt,
      composers,
    } = body
    
    // Remover featured do body - destaque só pode ser ativado via pagamento
    // O campo featured é controlado apenas pelo trigger do banco quando um pagamento é aprovado

    if (!title) {
      return NextResponse.json(
        { error: 'Título é obrigatório' },
        { status: 400 }
      )
    }

    // Garantir que o compositor logado está incluído
    const composerNames = composers || []
    if (!composerNames.includes(composer.name)) {
      composerNames.push(composer.name)
    }

    console.log('[API] Atualizando música:', {
      musicId,
      title,
      composerName: composer.name,
      composerNames,
    })

    // Não incluir featured - será mantido pelo trigger do banco baseado em pagamentos ativos
    const music = await db.updateMusic(musicId, {
      title,
      slug: slug || title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      genre: genre || null,
      spotifyUrl: spotifyUrl || null,
      spotifyEmbed: spotifyEmbed || null,
      appleMusicUrl: appleMusicUrl || null,
      appleMusicEmbed: appleMusicEmbed || null,
      tags: tags || null,
      description: description || null,
      publishedAt: new Date(publishedAt || new Date()),
      composers: composerNames,
    })

    console.log('[API] Música atualizada com sucesso:', music?.id)

    return NextResponse.json({
      success: true,
      music,
    })
  } catch (error: any) {
    console.error('[API] Erro ao atualizar música:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar música' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const musicId = params.id

    // Verificar se a música pertence ao compositor
    const { data: musicComposer } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('composer_id')
      .eq('music_id', musicId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!musicComposer) {
      return NextResponse.json(
        { error: 'Música não encontrada ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Verificar se compositor tem assinatura ativa
    const hasSubscription = await db.checkComposerHasActiveSubscription(composer.composerId)
    if (!hasSubscription) {
      return NextResponse.json(
        { error: 'Você precisa de uma assinatura ativa para gerenciar músicas' },
        { status: 403 }
      )
    }

    // Remover relacionamentos primeiro
    await supabaseAdmin
      .from('dccmusic_music_composers')
      .delete()
      .eq('music_id', musicId)

    // Deletar música
    const { error } = await supabaseAdmin
      .from('dccmusic_musics')
      .delete()
      .eq('id', musicId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao excluir música:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir música' },
      { status: 500 }
    )
  }
}
