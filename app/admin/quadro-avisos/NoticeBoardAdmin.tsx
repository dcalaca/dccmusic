'use client'

import { useEffect, useState } from 'react'
import { FiBell, FiCheckCircle, FiLoader, FiSave, FiToggleLeft, FiToggleRight } from 'react-icons/fi'

type Notice = {
  id: string
  title: string
  message: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export default function NoticeBoardAdmin() {
  const [notice, setNotice] = useState<Notice>({
    id: '',
    title: '',
    message: '',
    isActive: false,
    createdAt: null,
    updatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadNotice()
  }, [])

  const loadNotice = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/notices', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar aviso')

      setNotice(data.notice)
      setSetupRequired(Boolean(data.setupRequired))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar quadro de avisos')
    } finally {
      setLoading(false)
    }
  }

  const saveNotice = async (nextActive = notice.isActive) => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const response = await fetch('/api/admin/notices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notice.title,
          message: notice.message,
          isActive: nextActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar aviso')

      setNotice(data.notice)
      setSetupRequired(false)
      setSuccess(nextActive ? 'Aviso salvo e ativo.' : 'Aviso salvo e desativado.')
      window.dispatchEvent(new Event('noticeBoardChange'))
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar quadro de avisos')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = () => {
    saveNotice(!notice.isActive)
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-8 text-center text-gray-400">
        <FiLoader className="mx-auto mb-3 h-8 w-8 animate-spin text-primary-300" />
        Carregando quadro de avisos...
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-950 via-black to-purple-950/40 p-5 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-sm text-purple-100">
            <FiBell /> Quadro de avisos
          </div>
          <h1 className="text-3xl font-black text-white">Aviso para usuários logados</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Escreva um aviso e ative quando quiser exibir para compositores e usuários que estiverem logados no site.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleActive}
          disabled={saving}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition disabled:opacity-60 ${
            notice.isActive
              ? 'border border-green-700 bg-green-950/40 text-green-100 hover:bg-green-900/50'
              : 'border border-gray-700 bg-gray-900 text-gray-200 hover:border-purple-500'
          }`}
        >
          {notice.isActive ? <FiToggleRight className="h-5 w-5" /> : <FiToggleLeft className="h-5 w-5" />}
          {notice.isActive ? 'Aviso ativo' : 'Aviso desativado'}
        </button>
      </div>

      {setupRequired && (
        <div className="mb-5 rounded-xl border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-100">
          A tabela do quadro de avisos ainda não existe. Execute o arquivo <strong>SQL-CRIAR-QUADRO-AVISOS.sql</strong> no Supabase antes de salvar.
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-200">
          <FiCheckCircle /> {success}
        </div>
      )}

      <div className="grid gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-200">Título do aviso</span>
          <input
            value={notice.title}
            onChange={(event) => setNotice({ ...notice, title: event.target.value })}
            maxLength={90}
            placeholder="Ex: Aviso importante"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-200">Mensagem</span>
          <textarea
            value={notice.message}
            onChange={(event) => setNotice({ ...notice, message: event.target.value })}
            rows={8}
            maxLength={1000}
            placeholder="Digite aqui o aviso que será exibido para quem estiver logado..."
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-primary-500"
          />
          <span className="mt-1 block text-xs text-gray-500">{notice.message.length}/1000 caracteres</span>
        </label>

        <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Prévia</p>
          <div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-gray-950 via-purple-950/60 to-black p-5">
            <h2 className="text-xl font-black text-white">{notice.title || 'Título do aviso'}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-purple-100/90">
              {notice.message || 'A mensagem aparecerá aqui.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => saveNotice()}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white transition hover:from-primary-500 hover:to-purple-500 disabled:opacity-60 sm:w-fit"
        >
          {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
          {saving ? 'Salvando...' : 'Salvar aviso'}
        </button>
      </div>
    </section>
  )
}
