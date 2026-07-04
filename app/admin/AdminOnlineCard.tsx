'use client'

import { useEffect, useState } from 'react'
import { FiRefreshCw, FiUsers, FiX } from 'react-icons/fi'

type OnlineSummary = {
  setupRequired?: boolean
  total: number
  composers: number
  users: number
  activeWindowMinutes: number
  onlineComposers?: Array<{
    name: string
    lastSeen: string
  }>
  updatedAt: string
}

function formatTime(value?: string) {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminOnlineCard() {
  const [summary, setSummary] = useState<OnlineSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showComposers, setShowComposers] = useState(false)

  const loadOnlineUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/online-users', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar online')
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar online')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOnlineUsers()
  }, [])

  return (
    <div className="bg-gradient-to-br from-cyan-950/50 via-gray-900/70 to-black border border-cyan-800 rounded-lg p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-cyan-100">Pessoas online agora</h3>
          <p className="mt-1 text-xs text-gray-400">
            Atividade nos últimos {summary?.activeWindowMinutes || 10} minutos
          </p>
        </div>
        <FiUsers className="h-6 w-6 text-cyan-300" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-black text-white">{summary?.total ?? '--'}</p>
          <p className="mt-2 text-xs text-gray-400">
            {summary ? `${summary.composers} compositor(es) · ${summary.users} usuário(s)` : 'Carregando...'}
          </p>
          {summary?.setupRequired && (
            <p className="mt-2 text-xs font-semibold text-yellow-300">
              Rode o SQL de usuários online para ativar.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>

        <button
          type="button"
          onClick={loadOnlineUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-100 hover:border-cyan-300 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <p className="mt-4 text-[11px] text-gray-500">
        Atualizado às {formatTime(summary?.updatedAt)}
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowComposers(true)}
          className="text-xs font-bold text-cyan-200 underline decoration-cyan-600 underline-offset-4 hover:text-cyan-100"
        >
          Ver compositores online
        </button>
      </div>

      {showComposers && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-800 bg-gray-950 shadow-2xl shadow-cyan-950/40">
            <div className="flex items-start justify-between gap-4 border-b border-cyan-900/70 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-white">Compositores online</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Ativos nos últimos {summary?.activeWindowMinutes || 10} minutos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowComposers(false)}
                className="rounded-full border border-gray-800 p-2 text-gray-300 hover:border-cyan-500 hover:text-cyan-100"
                aria-label="Fechar"
              >
                <FiX />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto px-5 py-4">
              {summary?.onlineComposers?.length ? (
                <ul className="space-y-3">
                  {summary.onlineComposers.map((composer) => (
                    <li
                      key={`${composer.name}-${composer.lastSeen}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-black/30 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-semibold text-gray-100">{composer.name}</span>
                      <span className="shrink-0 text-[11px] text-gray-500">{formatTime(composer.lastSeen)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-gray-800 bg-black/30 px-3 py-4 text-center text-sm text-gray-400">
                  Nenhum compositor online agora.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-cyan-900/70 px-5 py-4">
              <p className="text-xs text-gray-500">
                Total: {summary?.composers ?? 0} compositor(es)
              </p>
              <button
                type="button"
                onClick={loadOnlineUsers}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-100 hover:border-cyan-300 disabled:opacity-60"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
