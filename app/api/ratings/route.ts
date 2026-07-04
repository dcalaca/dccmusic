import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { getPublicInteractionUserFromRequest } from '@/lib/public-interaction-auth'

type RateableContentType = 'music' | 'video' | 'studio_music'

function isRateableContentType(value: string | null): value is RateableContentType {
  return value === 'music' || value === 'video' || value === 'studio_music'
}

// GET - Buscar estatísticas de avaliação
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const contentId = searchParams.get('contentId')
    const authHeader = request.headers.get('authorization')

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType e contentId são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isRateableContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser "music", "video" ou "studio_music"' },
        { status: 400 }
      )
    }

    // Obter userId se houver token de visitante ou de compositor
    let userId: string | undefined
    if (authHeader) {
      const user = await getPublicInteractionUserFromRequest(request)
      if (user) {
        userId = user.userId
      }
    }

    const stats = await db.getRatingStats(contentType, contentId, userId)

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Erro ao buscar avaliações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar avaliações' },
      { status: 500 }
    )
  }
}

// POST - Criar ou atualizar avaliação
export async function POST(request: NextRequest) {
  try {
    const user = await getPublicInteractionUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para avaliar.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contentType, contentId, rating } = body

    if (!contentType || !contentId || !rating) {
      return NextResponse.json(
        { error: 'contentType, contentId e rating são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isRateableContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser "music", "video" ou "studio_music"' },
        { status: 400 }
      )
    }

    if (![1, 2, 3, 4, 5].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating deve ser entre 1 e 5' },
        { status: 400 }
      )
    }

    const newRating = await db.createOrUpdateRating(
      user.userId,
      contentType,
      contentId,
      rating
    )

    // Buscar estatísticas atualizadas
    const stats = await db.getRatingStats(contentType, contentId, user.userId)

    return NextResponse.json({
      success: true,
      rating: newRating,
      stats,
    })
  } catch (error: any) {
    console.error('Erro ao criar/atualizar avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar' },
      { status: 500 }
    )
  }
}

// DELETE - Remover avaliação
export async function DELETE(request: NextRequest) {
  try {
    const user = await getPublicInteractionUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const contentId = searchParams.get('contentId')

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType e contentId são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isRateableContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser "music", "video" ou "studio_music"' },
        { status: 400 }
      )
    }

    await db.deleteRating(user.userId, contentType, contentId)

    // Buscar estatísticas atualizadas
    const stats = await db.getRatingStats(contentType, contentId, user.userId)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error: any) {
    console.error('Erro ao deletar avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao remover avaliação' },
      { status: 500 }
    )
  }
}
