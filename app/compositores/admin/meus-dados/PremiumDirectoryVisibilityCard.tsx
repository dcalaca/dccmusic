'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi'

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
    <section className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_32%),rgba(3,7,18,0.92)] p-5 shadow-2xl shadow-black/20 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
            {visible ? <FiEye /> : <FiEyeOff />}
            Privacidade do perfil
          </div>
          <h2 className="text-xl font-black text-white sm:text-2xl">
            Visível na página de Compositores Premium
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            {visible
              ? 'Seu perfil pode aparecer na lista pública de Compositores Premium enquanto seu plano estiver ativo.'
              : 'Seu perfil está oculto da lista de Compositores Premium. Seu plano e suas músicas continuam normalmente ativos.'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Esta opção controla somente a listagem em Compositores Premium. Seu link público direto continua funcionando.
          </p>
        </div>

        <div className="w-full lg:w-auto lg:min-w-[280px]">
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
            <div>
              <p className={`text-sm font-black ${visible ? 'text-green-200' : 'text-gray-200'}`}>
                {saving ? 'Salvando...' : visible ? 'Perfil visível' : 'Perfil oculto'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {visible ? 'Clique para ocultar' : 'Clique para voltar a aparecer'}
              </p>
            </div>

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
