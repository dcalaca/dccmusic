'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FiCheckCircle, FiEyeOff, FiExternalLink, FiMessageCircle, FiRefreshCw, FiSearch, FiStar, FiTrash2 } from 'react-icons/fi'

type ContentType = 'music' | 'video' | 'studio_music'

type AdminComment = {
  id: string
  user: {
    name: string
    email?: string | null
  }
  content: {
    type: ContentType
    typeLabel: string
    title: string
    url?: string | null
  }
  comment: string
  isApproved: boolean
  createdAt: string
}

type AdminRating = {
  id: string
  user: {
    name: string
    email?: string | null
  }
  content: {
    type: ContentType
    typeLabel: string
    title: string
    url?: string | null
  }
  rating: number
  createdAt: string
}

type InteractionsResponse = {
  comments: AdminComment[]
  ratings: AdminRating[]
  stats: {
    totalComments: number
    approvedComments: number
    hiddenComments: number
    totalRatings: number
    averageRating: number
  }
}

const contentTypeOptions = [
  { value: 'all', label: 'Todos os conteúdos' },
  { value: 'music', label: 'Músicas' },
  { value: 'video', label: 'Vídeos' },
  { value: 'studio_music', label: 'Studio IA' },
]

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function AdminInteractionsPage() {
  const [data, setData] = useState<InteractionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [view, setView] = useState<'comments' | 'ratings'>('comments')
  const [contentType, setContentType] = useState<'all' | ContentType>('all')
  const [commentStatus, setCommentStatus] = useState<'all' | 'approved' | 'hidden'>('all')
  const [search, setSearch] = useState('')

  const loadInteractions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/interactions', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao carregar comentários e notas')
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar comentários e notas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInteractions()
  }, [])

  const filteredComments = useMemo(() => {
    const term = normalize(search)
    return (data?.comments || []).filter((comment) => {
      const matchesType = contentType === 'all' || comment.content.type === contentType
      const matchesStatus =
        commentStatus === 'all' ||
        (commentStatus === 'approved' && comment.isApproved) ||
        (commentStatus === 'hidden' && !comment.isApproved)
      const haystack = normalize(`${comment.user.name} ${comment.user.email || ''} ${comment.content.title} ${comment.comment}`)
      return matchesType && matchesStatus && (!term || haystack.includes(term))
    })
  }, [commentStatus, contentType, data?.comments, search])

  const filteredRatings = useMemo(() => {
    const term = normalize(search)
    return (data?.ratings || []).filter((rating) => {
      const matchesType = contentType === 'all' || rating.content.type === contentType
      const haystack = normalize(`${rating.user.name} ${rating.user.email || ''} ${rating.content.title} ${rating.rating}`)
      return matchesType && (!term || haystack.includes(term))
    })
  }, [contentType, data?.ratings, search])

  const updateCommentStatus = async (comment: AdminComment, isApproved: boolean) => {
    try {
      setActionLoading(comment.id)
      setError('')
      setSuccess('')
      const response = await fetch('/api/admin/interactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: comment.id, isApproved }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao atualizar comentário')
      setSuccess(isApproved ? 'Comentário aprovado e visível no site.' : 'Comentário ocultado do site.')
      await loadInteractions()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar comentário')
    } finally {
      setActionLoading('')
    }
  }

  const deleteItem = async (kind: 'comment' | 'rating', id: string) => {
    const label = kind === 'comment' ? 'comentário' : 'nota'
    if (!window.confirm(`Excluir este ${label}? Esta ação não pode ser desfeita.`)) return

    try {
      setActionLoading(id)
      setError('')
      setSuccess('')
      const response = await fetch(`/api/admin/interactions?kind=${kind}&id=${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Erro ao excluir ${label}`)
      setSuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} excluído com sucesso.`)
      await loadInteractions()
    } catch (err: any) {
      setError(err.message || `Erro ao excluir ${label}`)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="min-h-screen py-4">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              <span className="gradient-text">Comentários e Notas</span>
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Modere comentários de usuários e acompanhe avaliações das músicas, vídeos e Studio IA.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInteractions}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-200 hover:border-primary-500"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {data && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
              <p className="text-xs text-gray-400">Comentários</p>
              <p className="text-lg font-black text-blue-300">{data.stats.totalComments}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
              <p className="text-xs text-gray-400">Aprovados</p>
              <p className="text-lg font-black text-green-300">{data.stats.approvedComments}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
              <p className="text-xs text-gray-400">Ocultos</p>
              <p className="text-lg font-black text-yellow-300">{data.stats.hiddenComments}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
              <p className="text-xs text-gray-400">Notas</p>
              <p className="text-lg font-black text-purple-300">{data.stats.totalRatings}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
              <p className="text-xs text-gray-400">Média geral</p>
              <p className="text-lg font-black text-yellow-300">{data.stats.averageRating.toFixed(1)}</p>
            </div>
          </div>
        )}

        {error && <div className="mb-3 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
        {success && <div className="mb-3 rounded-xl border border-green-800 bg-green-950/40 p-3 text-sm text-green-200">{success}</div>}

        <div className="mb-3 rounded-xl border border-gray-800 bg-gray-900/50 p-3">
          <div className="grid gap-2 lg:grid-cols-[190px_190px_190px_1fr]">
            <div className="flex rounded-lg border border-gray-800 bg-gray-950 p-1">
              <button
                type="button"
                onClick={() => setView('comments')}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${view === 'comments' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                Comentários
              </button>
              <button
                type="button"
                onClick={() => setView('ratings')}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${view === 'ratings' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                Notas
              </button>
            </div>

            <select
              value={contentType}
              onChange={(event) => setContentType(event.target.value as any)}
              className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-white outline-none focus:border-primary-500"
            >
              {contentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={commentStatus}
              onChange={(event) => setCommentStatus(event.target.value as any)}
              disabled={view !== 'comments'}
              className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-white outline-none focus:border-primary-500 disabled:opacity-50"
            >
              <option value="all">Todos os status</option>
              <option value="approved">Aprovados</option>
              <option value="hidden">Ocultos</option>
            </select>

            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por usuário, e-mail, conteúdo ou texto..."
                className="w-full rounded-lg border border-gray-800 bg-gray-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-400">Carregando...</div>
        ) : view === 'comments' ? (
          <div className="space-y-2">
            {filteredComments.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-400">Nenhum comentário encontrado.</div>
            ) : filteredComments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-blue-200">
                        <FiMessageCircle /> {comment.content.typeLabel}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${comment.isApproved ? 'bg-green-950 text-green-200' : 'bg-yellow-950 text-yellow-200'}`}>
                        {comment.isApproved ? 'Aprovado' : 'Oculto'}
                      </span>
                      <span className="text-[11px] text-gray-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <h2 className="text-sm font-black text-white">{comment.content.title}</h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {comment.user.name}{comment.user.email ? ` · ${comment.user.email}` : ''}
                    </p>
                    <p className="mt-2 max-h-20 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-black/30 p-2 text-xs leading-5 text-gray-200">{comment.comment}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 lg:justify-end">
                    {comment.content.url && (
                      <Link href={comment.content.url} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1.5 text-[11px] font-bold text-gray-200 hover:border-primary-500">
                        <FiExternalLink /> Abrir
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => updateCommentStatus(comment, !comment.isApproved)}
                      disabled={actionLoading === comment.id}
                      className="inline-flex items-center gap-1 rounded-md border border-yellow-800 px-2 py-1.5 text-[11px] font-bold text-yellow-200 hover:bg-yellow-950/40 disabled:opacity-60"
                    >
                      {comment.isApproved ? <FiEyeOff /> : <FiCheckCircle />}
                      {comment.isApproved ? 'Ocultar' : 'Aprovar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem('comment', comment.id)}
                      disabled={actionLoading === comment.id}
                      className="inline-flex items-center gap-1 rounded-md border border-red-800 px-2 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-950/50 disabled:opacity-60"
                    >
                      <FiTrash2 /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRatings.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-400">Nenhuma nota encontrada.</div>
            ) : filteredRatings.map((rating) => (
              <div key={rating.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-purple-950 px-2 py-0.5 text-[11px] font-bold text-purple-200">{rating.content.typeLabel}</span>
                      <span className="text-[11px] text-gray-500">{formatDate(rating.createdAt)}</span>
                    </div>
                    <h2 className="text-sm font-black text-white">{rating.content.title}</h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {rating.user.name}{rating.user.email ? ` · ${rating.user.email}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-sm text-yellow-300">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <FiStar key={index} className={index < rating.rating ? 'fill-current' : 'text-gray-700'} />
                      ))}
                      <span className="ml-2 text-xs font-bold text-gray-200">{rating.rating}/5</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 lg:justify-end">
                    {rating.content.url && (
                      <Link href={rating.content.url} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1.5 text-[11px] font-bold text-gray-200 hover:border-primary-500">
                        <FiExternalLink /> Abrir
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteItem('rating', rating.id)}
                      disabled={actionLoading === rating.id}
                      className="inline-flex items-center gap-1 rounded-md border border-red-800 px-2 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-950/50 disabled:opacity-60"
                    >
                      <FiTrash2 /> Excluir nota
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
