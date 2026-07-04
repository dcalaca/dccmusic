import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

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
        { error: 'Você precisa de uma assinatura ativa para cadastrar músicas' },
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
      tags,
      description,
      publishedAt,
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

    // Criar música usando a função existente do admin, mas garantindo que o compositor logado está incluído
    const composerNames = composers || []
    if (!composerNames.includes(composer.name)) {
      composerNames.push(composer.name)
    }

    console.log('[API] Dados recebidos para criar música:', {
      title,
      slug: slug || title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      genre,
      composers: composerNames,
    })

    const music = await db.createMusic({
      title,
      slug: slug || title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      genre: genre || null,
      spotifyUrl: spotifyUrl || null,
      spotifyEmbed: spotifyEmbed || null,
      appleMusicUrl: null,
      appleMusicEmbed: null,
      tags: tags || null,
      description: description || null,
      coverUrl: null,
      featured: false, // Destaque só pode ser ativado via pagamento
      publishedAt: new Date(publishedAt || new Date()),
      composers: composerNames,
    })

    console.log('[API] Música criada com sucesso:', music?.id)

    return NextResponse.json({
      success: true,
      music,
    })
  } catch (error: any) {
    console.error('[API] Erro ao cadastrar música:', error)
    console.error('[API] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro ao cadastrar música', details: error.details || null },
      { status: 500 }
    )
  }
}
