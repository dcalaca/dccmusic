'use client'

import { useEffect, useState } from 'react'
import { FiHeart, FiSend, FiTrash2 } from 'react-icons/fi'
import { formatDate } from '@/lib/utils'

interface Comment {
  id: string
  userId: string
  userName: string
  userFirstName: string
  avatarUrl?: string | null
  parentId: string | null
  comment: string
  likesCount: number
  likedByMe: boolean
  createdAt: Date | string
}

function CommentAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = Boolean(photoUrl) && !photoFailed
  const initial = String(name || 'U').trim().slice(0, 1).toUpperCase() || 'U'

  return (
    <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xs font-black text-white">
      <span aria-hidden={showPhoto}>{initial}</span>
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}

interface CommentsSectionProps {
  contentType: 'music' | 'video' | 'studio_music'
  contentId: string
  isAuthenticated: boolean
  currentUserId?: string
  onLoginRequired?: () => void
}

export default function CommentsSection({
  contentType,
  contentId,
  isAuthenticated,
  currentUserId,
  onLoginRequired,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [viewerUserId, setViewerUserId] = useState<string | undefined>(currentUserId)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const [replyText, setReplyText] = useState('')
  const [likingId, setLikingId] = useState<string | null>(null)

  const getInteractionAuthToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('composer_token') || localStorage.getItem('site_user_token')
  }

  const authHeaders = (): HeadersInit => {
    const token = getInteractionAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    loadComments()
  }, [contentType, contentId, isAuthenticated])

  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/comments?contentType=${contentType}&contentId=${contentId}`,
        { headers: authHeaders() }
      )
      if (response.ok) {
        const data = await response.json()
        setComments(Array.isArray(data) ? data : data.comments || [])
        if (data?.currentUserId) setViewerUserId(data.currentUserId)
      }
    } catch (error) {
      console.error('Erro ao carregar comentários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAuthenticated) {
      onLoginRequired?.()
      return
    }

    if (!newComment.trim() || newComment.trim().length < 3) {
      alert('Comentário deve ter pelo menos 3 caracteres')
      return
    }

    try {
      setSubmitting(true)
      const token = getInteractionAuthToken()
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          contentType,
          contentId,
          comment: newComment.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao comentar')
      }

      setNewComment('')
      await loadComments()
    } catch (error: any) {
      console.error('Erro ao comentar:', error)
      alert(error.message || 'Erro ao comentar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyingTo) return

    if (!isAuthenticated) {
      onLoginRequired?.()
      return
    }

    if (!replyText.trim() || replyText.trim().length < 3) {
      alert('Resposta deve ter pelo menos 3 caracteres')
      return
    }

    try {
      setSubmitting(true)
      const token = getInteractionAuthToken()
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          contentType,
          contentId,
          parentId: replyingTo.id,
          comment: replyText.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao responder')
      }

      setReplyText('')
      setReplyingTo(null)
      await loadComments()
    } catch (error: any) {
      console.error('Erro ao responder:', error)
      alert(error.message || 'Erro ao responder')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (comment: Comment) => {
    if (!isAuthenticated) {
      onLoginRequired?.()
      return
    }

    const previous = comments
    setLikingId(comment.id)
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              likedByMe: !item.likedByMe,
              likesCount: item.likedByMe ? Math.max(0, item.likesCount - 1) : item.likesCount + 1,
            }
          : item
      )
    )

    try {
      const token = getInteractionAuthToken()
      const response = await fetch('/api/comments/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ commentId: comment.id }),
      })

      if (!response.ok) {
        throw new Error('Erro ao curtir')
      }

      const data = await response.json()
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, likedByMe: Boolean(data.liked), likesCount: Number(data.likesCount) || 0 }
            : item
        )
      )
    } catch (error) {
      console.error('Erro ao curtir comentário:', error)
      setComments(previous)
    } finally {
      setLikingId(null)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Deseja realmente deletar este comentário?')) {
      return
    }

    try {
      const token = getInteractionAuthToken()
      const response = await fetch(`/api/comments?commentId=${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar comentário')
      }

      setComments((current) =>
        current.filter((item) => item.id !== commentId && item.parentId !== commentId)
      )
      if (replyingTo?.id === commentId) {
        setReplyingTo(null)
        setReplyText('')
      }
    } catch (error: any) {
      console.error('Erro ao deletar comentário:', error)
      alert('Erro ao deletar comentário')
    }
  }

  const roots = comments.filter((comment) => !comment.parentId)
  const repliesByParent = comments.reduce((map, comment) => {
    if (!comment.parentId) return map
    const list = map.get(comment.parentId) || []
    list.push(comment)
    map.set(comment.parentId, list)
    return map
  }, new Map<string, Comment[]>())

  const myId = viewerUserId || currentUserId

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={isReply ? 'ml-8 sm:ml-12' : ''}>
      <div className={`rounded-lg p-4 ${isReply ? 'bg-gray-800/20' : 'bg-gray-800/30 border border-gray-700'}`}>
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CommentAvatar name={comment.userFirstName || comment.userName} photoUrl={comment.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-white">{comment.userFirstName}</div>
              <div className="text-xs text-gray-500">{formatDate(comment.createdAt)}</div>
            </div>
          </div>
          {myId === comment.userId && (
            <button
              onClick={() => handleDelete(comment.id)}
              className="flex-shrink-0 p-1 text-gray-400 transition-colors hover:text-red-400"
              title="Deletar comentário"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-gray-300">{comment.comment}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <button
            type="button"
            disabled={likingId === comment.id}
            onClick={() => handleLike(comment)}
            className={`flex items-center gap-1.5 transition-colors ${
              comment.likedByMe ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <FiHeart className={`h-4 w-4 ${comment.likedByMe ? 'fill-current' : ''}`} />
            <span>{comment.likesCount > 0 ? comment.likesCount : 'Curtir'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onLoginRequired?.()
                return
              }
              setReplyingTo(comment)
              setReplyText('')
            }}
            className="text-gray-400 transition-colors hover:text-white"
          >
            Responder
          </button>
        </div>

        {replyingTo?.id === comment.id && (
          <form onSubmit={handleReply} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Responder ${comment.userFirstName}...`}
              maxLength={500}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || replyText.trim().length < 3}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(null)
                  setReplyText('')
                }}
                className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:p-6">
      <h2 className="mb-6 text-2xl font-bold">
        <span className="gradient-text">Comentários</span>
        {comments.length > 0 && (
          <span className="ml-2 text-lg font-normal text-gray-400">({comments.length})</span>
        )}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escreva seu comentário..."
              rows={3}
              className="flex-1 resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && !replyingTo ? (
                'Enviando...'
              ) : (
                <>
                  <FiSend className="h-4 w-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </>
              )}
            </button>
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">{newComment.length}/500 caracteres</div>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center">
          <p className="mb-3 text-gray-400">
            Entre na sua conta para comentar, curtir e responder. Com a mesma conta você também cria músicas.
          </p>
          <button
            onClick={onLoginRequired}
            className="rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
          >
            Entrar ou criar conta
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400">Carregando comentários...</div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          Nenhum comentário ainda. Seja o primeiro a comentar!
        </div>
      ) : (
        <div className="space-y-4">
          {roots.map((comment) => (
            <div key={comment.id} className="space-y-3">
              {renderComment(comment)}
              {(repliesByParent.get(comment.id) || []).map((reply) => renderComment(reply, true))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
