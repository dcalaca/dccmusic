'use client'

import { useState, useEffect } from 'react'
import { FiSend, FiTrash2, FiUser } from 'react-icons/fi'
import { formatDate } from '@/lib/utils'

interface Comment {
  id: string
  userId: string
  userName: string
  userFirstName: string
  comment: string
  createdAt: Date
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
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getInteractionAuthToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('composer_token') || localStorage.getItem('site_user_token')
  }

  useEffect(() => {
    loadComments()
  }, [contentType, contentId])

  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/comments?contentType=${contentType}&contentId=${contentId}`
      )
      if (response.ok) {
        const data = await response.json()
        setComments(data)
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

      const data = await response.json()
      setComments([data.comment, ...comments])
      setNewComment('')
    } catch (error: any) {
      console.error('Erro ao comentar:', error)
      alert(error.message || 'Erro ao comentar')
    } finally {
      setSubmitting(false)
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

      setComments(comments.filter((c) => c.id !== commentId))
    } catch (error: any) {
      console.error('Erro ao deletar comentário:', error)
      alert('Erro ao deletar comentário')
    }
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">
        <span className="gradient-text">Comentários</span>
        {comments.length > 0 && (
          <span className="text-gray-400 text-lg font-normal ml-2">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* Formulário de comentário */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escreva seu comentário..."
              rows={3}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                'Enviando...'
              ) : (
                <>
                  <FiSend className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {newComment.length}/500 caracteres
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
          <p className="text-gray-400 mb-3">
            Entre como compositor para comentar e avaliar
          </p>
          <button
            onClick={onLoginRequired}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Entrar como compositor
          </button>
        </div>
      )}

      {/* Lista de comentários */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Carregando comentários...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          Nenhum comentário ainda. Seja o primeiro a comentar!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-800/30 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <FiUser className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">
                      {comment.userFirstName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(comment.createdAt)}
                    </div>
                  </div>
                </div>
                {currentUserId === comment.userId && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-400 transition-colors p-1"
                    title="Deletar comentário"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-gray-300 whitespace-pre-wrap break-words">
                {comment.comment}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
