'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSearch } from 'react-icons/fi'

export default function AdminMusicCodeLookup() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedCode = code.trim()

    if (!trimmedCode) {
      setError('Cole o código da música primeiro.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/admin/studio-music-lookup?code=${encodeURIComponent(trimmedCode)}`)
      const data = await response.json()

      if (!response.ok || !data?.targetUrl) {
        throw new Error(data?.error || 'Música não encontrada.')
      }

      router.push(data.targetUrl)
    } catch (err: any) {
      setError(err.message || 'Não consegui encontrar essa música.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-purple-900/60 bg-gradient-to-br from-purple-950/40 via-gray-950 to-black p-5">
      <div className="mb-4">
        <h2 className="text-xl font-black text-white">Encontrar música por código</h2>
        <p className="mt-1 text-sm text-gray-400">
          Cole o código que o cliente enviou para abrir a música no admin e ouvir.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            setError('')
          }}
          placeholder="Ex: 839a8ba8-c305-4292-9916-13415e788a2c"
          className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-black/60 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiSearch />
          {loading ? 'Buscando...' : 'Abrir música'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </form>
  )
}
