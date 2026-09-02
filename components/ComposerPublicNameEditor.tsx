'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiEdit3, FiInfo, FiUser } from 'react-icons/fi'

export default function ComposerPublicNameEditor({ initialName }: { initialName?: string }) {
  const [name, setName] = useState(initialName || '')
  const [loading, setLoading] = useState(!initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    if (initialName) return
    const token = localStorage.getItem('composer_token')
    if (!token) {
      setLoading(false)
      return
    }

    fetch('/api/compositores/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar nome público')
        setName(payload?.composer?.name || '')
      })
      .catch((err) => setError(err.message || 'Erro ao carregar nome público'))
      .finally(() => setLoading(false))
  }, [initialName])

  const save = async () => {
    const token = localStorage.getItem('composer_token')
    if (!token || !name.trim()) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const response = await fetch('/api/compositores/public-name', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Erro ao atualizar nome público')

      const formattedName = payload?.composer?.name || name.trim()
      setName(formattedName)

      const stored = localStorage.getItem('composer_data')
      if (stored) {
        try {
          const composer = JSON.parse(stored)
          localStorage.setItem('composer_data', JSON.stringify({ ...composer, name: formattedName }))
        } catch {}
      }

      window.dispatchEvent(new Event('authChange'))
      setSuccess('Nome público atualizado.')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar nome público')
    } finally {
      setSaving(false)
    }
  }

  return (
        <section className="mb-5 rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary-300/20 bg-primary-400/10 text-primary-200">
              <FiUser className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white sm:text-2xl">Nome público</h2>
              <button type="button" onClick={() => setShowInfo((current) => !current)} aria-label="Saiba mais sobre o nome público" aria-expanded={showInfo} className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
                <FiInfo className="h-4 w-4" /> Saiba mais
              </button>
            </div>
          </div>
          {showInfo && <p className="mb-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-relaxed text-gray-400">É o nome que aparece no seu perfil público e nas suas músicas. Você pode alterar quando quiser.</p>}

          {loading ? (
            <div className="h-11 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">Como seu nome será exibido</label>
                <div className="relative">
                  <FiEdit3 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    maxLength={100}
                    onChange={(event) => {
                      setName(event.target.value)
                      setError('')
                      setSuccess('')
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/35 py-3 pl-10 pr-4 text-white outline-none transition focus:border-primary-400/60"
                    placeholder="Seu nome público"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Não precisa se preocupar com maiúsculas e minúsculas: a DCC Music ajusta automaticamente para manter o padrão.
                </p>
              </div>

              <button
                type="button"
                onClick={save}
                disabled={saving || !name.trim()}
                className="self-end rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:from-primary-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm font-semibold text-red-300">{error}</p>}
          {success && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-green-300">
              <FiCheckCircle /> {success}
            </p>
          )}
        </section>
  )
}
