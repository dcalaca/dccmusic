'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSearch, FiUser } from 'react-icons/fi'

export default function AdminComposerLookup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim()
    if (!normalizedEmail) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/composers/lookup?email=${encodeURIComponent(normalizedEmail)}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.composer?.id) {
        throw new Error(data?.error || 'Usuário não encontrado.')
      }

      router.push(`/admin/compositores/${data.composer.id}`)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível localizar o usuário.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl border border-purple-800 bg-purple-950/40 p-3">
          <FiUser className="h-5 w-5 text-purple-300" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">Acesso rápido ao usuário</h2>
          <p className="mt-1 text-sm text-gray-400">
            Cole o e-mail para abrir o perfil do compositor sem carregar a lista completa.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@email.com"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiSearch className="h-4 w-4" />
          {loading ? 'Buscando...' : 'Abrir perfil'}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm font-medium text-red-400">{error}</p>
      )}
    </div>
  )
}
