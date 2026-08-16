import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { getPublicInteractionUserFromRequest } from '@/lib/public-interaction-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendStudioMusicCommentEmail } from '@/lib/dcc-emails'
import { notifyCommentReply, notifyNewComment } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

type CommentableContentType = 'music' | 'video' | 'studio_music'

function isCommentableContentType(value: string | null): value is CommentableContentType {
  return value === 'music' || value === 'video' || value === 'studio_music'
}

async function notifyStudioComposerAboutComment(contentId: string, newComment: db.Comment) {
  const { data: project, error } = await supabaseAdmin
    .from('studio_projects')
    .select('id, title, public_slug, composer:dccmusic_composers(id, name, email)')
    .eq('id', contentId)
    .maybeSingle()

  const composer = Array.isArray(project?.composer) ? project?.composer[0] : project?.composer

  if (error || !composer?.email || !project?.public_slug) {
    if (error) console.warn('[COMMENTS] Não foi possível buscar compositor do Studio:', error.message)
    return
  }

  await sendStudioMusicCommentEmail({
    composerId: composer.id,
    name: composer.name,
    email: composer.email,
    projectTitle: project.title,
    projectSlug: project.public_slug,
    commenterName: newComment.userName || newComment.userFirstName || 'Um usuário',
    comment: newComment.comment,
    commentId: newComment.id,
  }).catch((emailError) => {
    console.error('[COMMENTS] Erro ao enviar e-mail de novo comentário Studio:', emailError)
  })
}

// GET - Buscar comentários
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const contentId = searchParams.get('contentId')

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType e contentId são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isCommentableContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser "music", "video" ou "studio_music"' },
        { status: 400 }
      )
    }

    const viewer = await getPublicInteractionUserFromRequest(request)
    const comments = await db.getComments(contentType, contentId, viewer?.userId)

    return NextResponse.json({
      comments,
      currentUserId: viewer?.userId || null,
    })
  } catch (error: any) {
    console.error('Erro ao buscar comentários:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar comentários' },
      { status: 500 }
    )
  }
}

// POST - Criar comentário ou resposta
export async function POST(request: NextRequest) {
  try {
    const user = await getPublicInteractionUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para comentar.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contentType, contentId, comment } = body
    const replyToId = typeof body.parentId === 'string' ? body.parentId : null

    if (!contentType || !contentId || !comment) {
      return NextResponse.json(
        { error: 'contentType, contentId e comment são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isCommentableContentType(contentType)) {
      return NextResponse.json(
        { error: 'contentType deve ser "music", "video" ou "studio_music"' },
        { status: 400 }
      )
    }

    if (!comment.trim() || comment.trim().length < 3) {
      return NextResponse.json(
        { error: 'Comentário deve ter pelo menos 3 caracteres' },
        { status: 400 }
      )
    }

    let storedParentId: string | null = null
    let replyTarget: db.Comment | null = null

    if (replyToId) {
      replyTarget = await db.getCommentById(replyToId)
      if (
        !replyTarget ||
        replyTarget.contentType !== contentType ||
        replyTarget.contentId !== contentId
      ) {
        return NextResponse.json(
          { error: 'Comentário para responder não encontrado' },
          { status: 404 }
        )
      }
      storedParentId = replyTarget.parentId || replyTarget.id
    }

    const newComment = await db.createComment(
      user.userId,
      contentType,
      contentId,
      comment,
      storedParentId
    )

    const actorName = user.firstName || user.name

    if (replyTarget) {
      await notifyCommentReply({
        actorSiteUserId: user.userId,
        actorName,
        parentAuthorSiteUserId: replyTarget.userId,
        contentType,
        contentId,
        commentId: newComment.id,
        comment: newComment.comment,
      }).catch((notifyError) => {
        console.error('[COMMENTS] Erro ao notificar resposta:', notifyError)
      })
    } else {
      await notifyNewComment({
        actorSiteUserId: user.userId,
        actorName,
        contentType,
        contentId,
        commentId: newComment.id,
        comment: newComment.comment,
      }).catch((notifyError) => {
        console.error('[COMMENTS] Erro ao notificar comentário:', notifyError)
      })

      if (contentType === 'studio_music') {
        await notifyStudioComposerAboutComment(contentId, newComment)
      }
    }

    return NextResponse.json({
      success: true,
      comment: newComment,
    })
  } catch (error: any) {
    console.error('Erro ao criar comentário:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao comentar' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar comentário
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
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { error: 'commentId é obrigatório' },
        { status: 400 }
      )
    }

    await db.deleteComment(commentId, user.userId)

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('Erro ao deletar comentário:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar comentário' },
      { status: 500 }
    )
  }
}
