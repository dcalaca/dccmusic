'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FiCalendar, FiMail, FiRefreshCw, FiSend } from 'react-icons/fi'

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom'

type EmailSummary = {
  counts: {
    sentEmails: number
  }
  externalBalances?: {
    resend?: {
      configured: boolean
      sentEmails: number
      transactionalEmails?: number
      campaignEmails?: number
      categories: Array<{
        category: string
        count: number
      }>
      error: string | null
      checkedAt: string
    }
  }
}

const presetLabels: Record<Preset, string> = {
  today: 'Hoje',
  last7: 'Últimos 7 dias',
  last30: 'Últimos 30 dias',
  thisMonth: 'Este mês',
  custom: 'Personalizado',
}

function dateToInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getPresetRange(preset: Preset) {
  const now = new Date()
  if (preset === 'today') return { startDate: dateToInput(now), endDate: dateToInput(now) }
  if (preset === 'last7') return { startDate: dateToInput(addDays(now, -6)), endDate: dateToInput(now) }
  if (preset === 'last30') return { startDate: dateToInput(addDays(now, -29)), endDate: dateToInput(now) }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: dateToInput(start), endDate: dateToInput(now) }
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

export default function EmailControlPanel() {
  const [preset, setPreset] = useState<Preset>('thisMonth')
  const [range, setRange] = useState(() => getPresetRange('thisMonth'))
  const [summary, setSummary] = useState<EmailSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/finance?${queryString}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar controle de e-mails')
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar controle de e-mails')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const selectPreset = (nextPreset: Preset) => {
    setPreset(nextPreset)
    setSummary(null)
    setError('')
    if (nextPreset !== 'custom') setRange(getPresetRange(nextPreset))
  }

  const updateDate = (field: 'startDate' | 'endDate', value: string) => {
    setPreset('custom')
    setSummary(null)
    setError('')
    setRange(current => ({ ...current, [field]: value }))
  }

  const transactional = summary?.externalBalances?.resend?.transactionalEmails || 0
  const campaigns = summary?.externalBalances?.resend?.campaignEmails || 0
  const total = summary?.counts.sentEmails || 0
  const categories = summary?.externalBalances?.resend?.categories || []

  return (
    <section className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800 rounded-2xl p-5 sm:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-fuchsia-300 mb-2">
            <FiMail className="w-4 h-4" />
            E-mails
          </div>
          <h1 className="text-2xl font-bold">Controle de e-mails</h1>
          <p className="text-gray-400 text-sm mt-1">
            Acompanhe os envios transacionais e as campanhas da DCC Music.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/email-campanhas"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-fuchsia-900/70 bg-fuchsia-950/30 text-fuchsia-200 hover:border-fuchsia-500 transition-colors"
          >
            <FiSend className="w-4 h-4" />
            Campanhas
          </Link>
          <button
            type="button"
            onClick={loadSummary}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-primary-400 hover:text-primary-300 transition-colors disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(presetLabels) as Preset[]).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => selectPreset(item)}
            className={`text-sm underline-offset-4 transition-colors ${preset === item ? 'text-fuchsia-300 underline' : 'text-gray-400 hover:text-fuchsia-300 hover:underline'}`}
          >
            {presetLabels[item]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <label className="block">
          <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Data inicial</span>
          <input type="date" value={range.startDate} onChange={event => updateDate('startDate', event.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" />Data final</span>
          <input type="date" value={range.endDate} onChange={event => updateDate('endDate', event.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
        </label>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800 text-red-200 rounded-lg p-4 mb-6 text-sm">{error}</div>}

      {!summary ? (
        <div className="border border-gray-800 rounded-xl p-6 text-gray-400 text-sm">
          {loading ? 'Carregando controle de e-mails...' : 'Escolha o período e clique em Atualizar.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-950/70 border border-fuchsia-900/60 rounded-xl p-4">
              <p className="text-sm text-gray-400">Total enviado</p>
              <p className="text-3xl font-bold text-fuchsia-300 mt-2">{formatNumber(total)}</p>
            </div>
            <div className="bg-gray-950/70 border border-blue-900/60 rounded-xl p-4">
              <p className="text-sm text-gray-400">Transacionais</p>
              <p className="text-3xl font-bold text-blue-300 mt-2">{formatNumber(transactional)}</p>
              <p className="text-xs text-gray-500 mt-1">Cadastro, pagamento, alertas e sistema</p>
            </div>
            <div className="bg-gray-950/70 border border-purple-900/60 rounded-xl p-4">
              <p className="text-sm text-gray-400">Campanhas</p>
              <p className="text-3xl font-bold text-purple-300 mt-2">{formatNumber(campaigns)}</p>
              <p className="text-xs text-gray-500 mt-1">Disparos feitos pelo admin</p>
            </div>
          </div>

          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold">Tipos de e-mail</h2>
              <span className="text-xs text-gray-500">{categories.length} tipo(s)</span>
            </div>
            {categories.length ? (
              <div className="space-y-2">
                {categories.map(item => (
                  <div key={item.category} className="flex items-center justify-between gap-4 border border-gray-800 rounded-lg px-3 py-3">
                    <span className="text-sm text-gray-300 break-all">{item.category}</span>
                    <span className="font-semibold text-white">{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum e-mail registrado neste período.</p>
            )}
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Brevo está sendo utilizado no plano gratuito; por isso esta página acompanha volume e tipos de envio, sem lançar custo no financeiro.
          </p>
        </>
      )}
    </section>
  )
}
