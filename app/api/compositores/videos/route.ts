import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import * as db from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se compositor tem assinatura ativa
    const hasSubscription = await db.checkComposerHasActiveSubscription(composer.composerId)
    if (!hasSubscription) {
      return NextResponse.json(
        { error: 'Você precisa de uma assinatura ativa para cadastrar vídeos' },
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { featured, ...restBody } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Título é obrigatório' },
        { status: 400 }
      )
    }

    // Criar vídeo usando a função existente do admin, mas garantindo que o compositor logado está incluído
    const composerNames = Array.isArray(composers) ? composers.filter((c: any) => c && c.trim && c.trim() !== '') : []
    
    // Garantir que sempre haja pelo menos o compositor logado
    if (composerNames.length === 0) {
      console.warn('[API] Nenhum compositor fornecido, adicionando compositor logado:', composer.name)
      composerNames.push(composer.name)
    } else if (!composerNames.includes(composer.name)) {
      console.log('[API] Compositor logado não está na lista, adicionando:', composer.name)
      composerNames.push(composer.name)
    }

    console.log('[API] Criando vídeo com compositores:', {
      title,
      composerName: composer.name,
      composerId: composer.composerId,
      composerNames,
      numComposers: composerNames.length,
    })

    const video = await db.createVideo({
      title,
      slug: slug || title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      youtubeUrl: youtubeUrl || '',
      youtubeId: youtubeId || '',
      youtubeEmbed: youtubeEmbed || null,
      genre: genre || null,
      tags: tags || null,
      description: description || null,
      featured: false, // Destaque só pode ser ativado via pagamento
      publishedAt: new Date(publishedAt || new Date()),
      thumbnailUrl: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
      duration: duration || null,
      composers: composerNames,
    })

    console.log('[API] Vídeo criado com sucesso:', video?.id)

    return NextResponse.json({
      success: true,
      video,
    })
  } catch (error: any) {
    console.error('[API] Erro ao cadastrar vídeo:', error)
    console.error('[API] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro ao cadastrar vídeo', details: error.details || null },
      { status: 500 }
    )
  }
}
