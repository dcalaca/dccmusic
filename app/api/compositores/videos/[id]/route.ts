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

    const videoId = params.id

    // Verificar se o vídeo pertence ao compositor
    const { data: videoComposer } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('composer_id')
      .eq('video_id', videoId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!videoComposer) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Buscar o vídeo com compositores
    const video = await db.getVideoById(videoId)

    return NextResponse.json({
      success: true,
      video,
    })
  } catch (error: any) {
    console.error('[API] Erro ao buscar vídeo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar vídeo' },
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

    const videoId = params.id

    // Verificar se o vídeo pertence ao compositor
    const { data: videoComposer } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('composer_id')
      .eq('video_id', videoId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!videoComposer) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Verificar se compositor tem assinatura ativa
    const hasSubscription = await db.checkComposerHasActiveSubscription(composer.composerId)
    if (!hasSubscription) {
      return NextResponse.json(
        { error: 'Você precisa de uma assinatura ativa para gerenciar vídeos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      slug,
      youtubeUrl,
      youtubeId,
      youtubeEmbed,
      genre,
      tags,
      description,
      publishedAt,
      duration,
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

    // Criar vídeo usando a função existente do admin, mas garantindo que o compositor logado está incluído
    const composerNames = composers || []
    if (!composerNames.includes(composer.name)) {
      composerNames.push(composer.name)
    }

    console.log('[API] Atualizando vídeo:', {
      videoId,
      title,
      composerName: composer.name,
      composerNames,
    })

    // Não incluir featured - será mantido pelo trigger do banco baseado em pagamentos ativos
    const video = await db.updateVideo(videoId, {
      title,
      slug: slug || title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      youtubeUrl: youtubeUrl || '',
      youtubeId: youtubeId || '',
      youtubeEmbed: youtubeEmbed || null,
      genre: genre || null,
      tags: tags || null,
      description: description || null,
      publishedAt: new Date(publishedAt || new Date()),
      thumbnailUrl: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
      duration: duration || null,
      composers: composerNames,
    })

    console.log('[API] Vídeo atualizado com sucesso:', video?.id)

    return NextResponse.json({
      success: true,
      video,
    })
  } catch (error: any) {
    console.error('[API] Erro ao atualizar vídeo:', error)
    console.error('[API] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar vídeo', details: error.details || null },
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

    const videoId = params.id

    // Verificar se o vídeo pertence ao compositor
    const { data: videoComposer } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('composer_id')
      .eq('video_id', videoId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (!videoComposer) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado ou você não tem permissão' },
        { status: 404 }
      )
    }

    // Verificar se compositor tem assinatura ativa
    const hasSubscription = await db.checkComposerHasActiveSubscription(composer.composerId)
    if (!hasSubscription) {
      return NextResponse.json(
        { error: 'Você precisa de uma assinatura ativa para gerenciar vídeos' },
        { status: 403 }
      )
    }

    // Remover relacionamentos primeiro
    await supabaseAdmin
      .from('dccmusic_video_composers')
      .delete()
      .eq('video_id', videoId)

    // Deletar vídeo
    const { error } = await supabaseAdmin
      .from('dccmusic_videos')
      .delete()
      .eq('id', videoId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao excluir vídeo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir vídeo' },
      { status: 500 }
    )
  }
}
