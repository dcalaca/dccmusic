'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiEye, FiEyeOff, FiInfo, FiLoader } from 'react-icons/fi'

export default function PremiumDirectoryVisibilityCard() {
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      setLoading(false)
      return
    }

    fetch('/api/compositores/directory-visibility', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar preferência')
        setVisible(payload.visible !== false)
      })
      .catch((err) => setError(err.message || 'Erro ao carregar preferência'))
      .finally(() => setLoading(false))
  }, [])

  const updateVisibility = async (nextVisible: boolean) => {
    const token = localStorage.getItem('composer_token')
    if (!token || saving) return

    try {
      setSaving(true)
      setError('')
      setSaved(false)

      const response = await fetch('/api/compositores/directory-visibility', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visible: nextVisible }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar preferência')

      setVisible(payload.visible !== false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar preferência')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <FiLoader className="h-5 w-5 animate-spin text-primary-300" />
          Carregando preferência de privacidade...
        </div>
      </section>
    )
  }

  return (
    <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.025] p-3 shadow-lg shadow-black/10 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {visible ? <FiEye className="shrink-0 text-green-300" /> : <FiEyeOff className="shrink-0 text-gray-400" />}
          <span className="truncate text-sm font-bold text-gray-200">Visível na página de Compositores</span>
          <span title="Controla apenas se seu perfil aparece na lista pública de Compositores Premium. O link direto continua funcionando." className="shrink-0 text-gray-500"><FiInfo /></span>
        </div>
        <div className="w-auto shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={visible}
            aria-label="Visibilidade na página de Compositores Premium"
            disabled={saving}
            onClick={() => updateVisibility(!visible)}
            className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition disabled:cursor-wait disabled:opacity-70 ${
              visible
                ? 'border-green-500/35 bg-green-950/20 hover:bg-green-950/30'
                : 'border-gray-700 bg-black/30 hover:bg-black/45'
            }`}
          >
            <span className={`text-xs font-black ${visible ? 'text-green-200' : 'text-gray-200'}`}>{saving ? '...' : visible ? 'Visível' : 'Oculto'}</span>

            <span
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${
                visible ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  visible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          {saved && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-300">
              <FiCheckCircle /> Preferência salva
            </p>
          )}
          {error && <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>}
        </div>
      </div>
    </section>
  )
}
