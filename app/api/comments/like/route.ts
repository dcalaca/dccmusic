import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { notifyCommentLike } from '@/lib/notifications'
import { getPublicInteractionUserFromRequest } from '@/lib/public-interaction-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getPublicInteractionUserFromRequest(request, { createForComposer: true })
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para curtir.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const commentId = typeof body.commentId === 'string' ? body.commentId : ''
    if (!commentId) {
      return NextResponse.json({ error: 'commentId é obrigatório' }, { status: 400 })
    }

    const result = await db.toggleCommentLike(commentId, user.userId)

    if (result.liked) {
      await notifyCommentLike({
        actorSiteUserId: user.userId,
        actorName: user.firstName || user.name,
        commentAuthorSiteUserId: result.comment.userId,
        contentType: result.comment.contentType,
        contentId: result.comment.contentId,
        commentId: result.comment.id,
      }).catch((notifyError) => {
        console.error('[COMMENTS] Erro ao notificar curtida:', notifyError)
      })
    }

    return NextResponse.json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    })
  } catch (error: any) {
    console.error('Erro ao curtir comentário:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao curtir comentário' },
      { status: 500 }
    )
  }
}
