'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiRefreshCw, FiSearch, FiZap } from 'react-icons/fi'

type BalanceRow = {
  position: number
  composerId: string
  name: string
  email: string
  slug: string
  planName: string | null
  hasStudioPlan: boolean
  creditsLimit: number
  baseMonthlyCredits: number
  topupCredits: number
  creditsUsed: number
  creditsRemaining: number
  musicBalance: number
  monthKey: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value || 0)
}

export default function AdminComposerBalancesPage() {
  const [ranking, setRanking] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')
  const [failedCount, setFailedCount] = useState(0)

  const loadBalances = async () => {
    setLoading(true)
    setError('')
    setFailedCount(0)
    try {
      const response = await fetch('/api/admin/composers/balance-ranking', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar saldos')

      setRanking(data.ranking || [])
      setGeneratedAt(data.generatedAt || '')
      setFailedCount(Array.isArray(data.failedComposers) ? data.failedComposers.length : 0)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar saldos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBalances()
  }, [])

  const filteredRanking = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return ranking

    return ranking.filter((row) => (
      row.name.toLowerCase().includes(term) ||
      row.email.toLowerCase().includes(term) ||
      row.slug.toLowerCase().includes(term) ||
      String(row.planName || '').toLowerCase().includes(term)
    ))
  }, [ranking, search])

  const totals = useMemo(() => {
    return ranking.reduce(
      (summary, row) => ({
        creditsRemaining: summary.creditsRemaining + row.creditsRemaining,
        creditsUsed: summary.creditsUsed + row.creditsUsed,
        studioPlans: summary.studioPlans + (row.hasStudioPlan ? 1 : 0),
      }),
      { creditsRemaining: 0, creditsUsed: 0, studioPlans: 0 }
    )
  }, [ranking])

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
          <FiArrowLeft /> Voltar ao painel
        </Link>

        <div className="mb-6 rounded-2xl border border-purple-800/70 bg-gradient-to-br from-purple-950/50 via-gray-950 to-black p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/50 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                <FiZap /> Studio IA
              </div>
              <h1 className="text-3xl font-black sm:text-4xl">
                <span className="gradient-text">Saldos dos compositores</span>
              </h1>
              <p className="mt-2 text-sm text-gray-300">
                Ranking do maior para o menor saldo atual de créditos.
              </p>
              {generatedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  Atualizado em {new Date(generatedAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={loadBalances}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-700 bg-purple-950/40 px-4 py-3 font-bold text-purple-100 hover:bg-purple-900/50 disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Compositores" value={formatNumber(ranking.length)} />
            <SummaryCard label="Com Studio IA ativo" value={formatNumber(totals.studioPlans)} />
            <SummaryCard label="Créditos disponíveis" value={formatNumber(totals.creditsRemaining)} />
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail, slug ou plano..."
              className="w-full rounded-xl border border-gray-700 bg-black/40 py-3 pl-10 pr-4 text-white outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">
            {error}
          </div>
        )}

        {!error && failedCount > 0 && (
          <div className="mb-5 rounded-xl border border-yellow-800 bg-yellow-950/40 p-4 text-yellow-100">
            {failedCount} compositor(es) não carregaram por instabilidade temporária. Clique em Atualizar para tentar novamente.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Carregando saldos...</div>
          ) : filteredRanking.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nenhum compositor encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800 text-sm">
                <thead className="bg-black/40 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Compositor</th>
                    <th className="px-4 py-3 text-left">Plano</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-right">Músicas</th>
                    <th className="px-4 py-3 text-right">Usados</th>
                    <th className="px-4 py-3 text-right">Liberados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredRanking.map((row) => (
                    <tr key={row.composerId} className="hover:bg-gray-900/70">
                      <td className="px-4 py-3 text-gray-500">{row.position}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{row.name}</p>
                        <p className="text-xs text-gray-500">{row.email || row.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.hasStudioPlan ? 'bg-purple-950 text-purple-100' : 'bg-gray-800 text-gray-300'}`}>
                          {row.planName || 'Sem Studio IA'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-black text-green-300">
                        {formatNumber(row.creditsRemaining)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatNumber(row.musicBalance)}</td>
                      <td className="px-4 py-3 text-right text-yellow-300">{formatNumber(row.creditsUsed)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatNumber(row.creditsLimit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  )
}
