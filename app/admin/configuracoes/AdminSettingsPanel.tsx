'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiLoader, FiSave, FiSettings } from 'react-icons/fi'

type AdminSetting = {
  key: string
  label: string
  description: string
  group: string
  type: 'number' | 'text' | 'boolean'
  min: number | null
  max: number | null
  defaultValue: string
  value: string
  stored: boolean
  updatedAt: string | null
  updatedBy: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não salvo no banco'
  return new Date(value).toLocaleString('pt-BR')
}

export default function AdminSettingsPanel() {
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const groups = useMemo(() => {
    const map = new Map<string, AdminSetting[]>()
    for (const setting of settings) {
      const list = map.get(setting.group) || []
      list.push(setting)
      map.set(setting.group, list)
    }
    return Array.from(map.entries())
  }, [settings])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/settings', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar configurações')

      const nextSettings: AdminSetting[] = data.settings || []
      setSettings(nextSettings)
      setDrafts(
        Object.fromEntries(nextSettings.map((item) => [item.key, item.value]))
      )
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (key: string) => {
    setError('')
    setSuccess('')
    setSavingKey(key)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: drafts[key],
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar')

      const nextSettings: AdminSetting[] = data.settings || []
      setSettings(nextSettings)
      setDrafts(
        Object.fromEntries(nextSettings.map((item) => [item.key, item.value]))
      )
      setSuccess(data.message || 'Configuração salva.')
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar configuração')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/50 p-6 text-gray-300">
        <FiLoader className="h-5 w-5 animate-spin" />
        Carregando configurações...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-2 flex items-center gap-3">
          <FiSettings className="h-6 w-6 text-primary-400" />
          <h1 className="text-3xl font-bold">
            <span className="gradient-text">Configurações</span>
          </h1>
        </div>
        <p className="text-sm leading-6 text-gray-400">
          Ajuste parâmetros do sistema sem precisar mexer em variáveis da Vercel.
          Novas opções podem ser adicionadas aqui no futuro.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-200">
          {success}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 text-gray-400">
          Nenhuma configuração disponível.
        </div>
      ) : (
        groups.map(([groupName, items]) => (
          <section key={groupName} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">{groupName}</h2>
            {items.map((setting) => {
              const dirty = drafts[setting.key] !== setting.value
              const saving = savingKey === setting.key

              return (
                <div
                  key={setting.key}
                  className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5"
                >
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">{setting.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">{setting.description}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Padrão: {setting.defaultValue}
                      {setting.min != null || setting.max != null
                        ? ` · Faixa: ${setting.min ?? '—'} a ${setting.max ?? '—'}`
                        : ''}
                      {' · '}
                      Atualizado: {formatDateTime(setting.updatedAt)}
                      {setting.updatedBy ? ` por ${setting.updatedBy}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Valor
                      </span>
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        min={setting.min ?? undefined}
                        max={setting.max ?? undefined}
                        value={drafts[setting.key] ?? ''}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [setting.key]: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={saving || !dirty}
                      onClick={() => handleSave(setting.key)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        ))
      )}
    </div>
  )
}
