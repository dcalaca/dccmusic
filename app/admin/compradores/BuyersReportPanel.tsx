'use client'

import { useMemo, useState } from 'react'
import { FiCalendar, FiDownload, FiRefreshCw, FiUsers } from 'react-icons/fi'

type PurchaseRow = {
  paymentId: string
  paidAt: string | null
  amount: number
  status: string
  paymentMethod: string
  source: string
  email: string
  name: string
  firstName: string
  lastName: string
  phone: string
  document: string
  externalReference: string
}

type BuyerRow = {
  email: string
  name: string
  firstName: string
  lastName: string
  phone: string
  document: string
  purchaseCount: number
  totalAmount: number
  firstPurchaseAt: string | null
  lastPurchaseAt: string | null
  isRecurring: boolean
  paymentMethods: string
  sources: string
}

type BuyersReport = {
  period: {
    startDate: string
    endDate: string
  }
  mercadoPago: {
    configured: boolean
    fetched: number
    matchedLocal?: number
    pages: number
    error: string | null
  }
  warnings: string[]
  totals: {
    purchases: number
    buyers: number
    recurringBuyers: number
    amount: number
    withPhone: number
    withEmail: number
  }
  purchases: PurchaseRow[]
  buyers: BuyerRow[]
  recurringBuyers: BuyerRow[]
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

function getDefaultRange() {
  const now = new Date()
  return {
    startDate: dateToInput(addDays(now, -364)),
    endDate: dateToInput(now),
  }
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

export default function BuyersReportPanel() {
  const [range, setRange] = useState(getDefaultRange)
  const [report, setReport] = useState<BuyersReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'recurring' | 'buyers' | 'purchases'>('recurring')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    return params.toString()
  }, [range])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/reports/buyers?${queryString}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar compradores')
      setReport(data)
    } catch (err: any) {
      setReport(null)
      setError(err.message || 'Erro ao carregar compradores')
    } finally {
      setLoading(false)
    }
  }

  const clearResult = (key: 'startDate' | 'endDate', value: string) => {
    setRange(prev => ({ ...prev, [key]: value }))
    setReport(null)
    setError('')
  }

  const downloadCsv = (scope: 'purchases' | 'buyers' | 'recurring') => {
    const params = new URLSearchParams()
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    params.set('format', 'csv')
    params.set('scope', scope)
    window.open(`/api/admin/reports/buyers?${params.toString()}`, '_blank')
  }

  const tableRows = tab === 'purchases'
    ? report?.purchases || []
    : tab === 'buyers'
      ? report?.buyers || []
      : report?.recurringBuyers || []

  return (
    <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-black p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-primary-300">Relatórios do admin</p>
          <h1 className="mt-2 text-3xl font-black text-white">Compradores Mercado Pago</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Lista compras e compradores (com telefone quando o Mercado Pago tiver).
            Use o CSV de recorrentes para subir no Meta Ads.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReport}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Buscar no Mercado Pago
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <FiCalendar className="h-3 w-3" />
            Data inicial
          </span>
          <input
            type="date"
            value={range.startDate}
            onChange={event => clearResult('startDate', event.target.value)}
            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <FiCalendar className="h-3 w-3" />
            Data final
          </span>
          <input
            type="date"
            value={range.endDate}
            onChange={event => clearResult('endDate', event.target.value)}
            className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Consultando Mercado Pago e base local... isso pode levar alguns segundos.
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-gray-800 p-6 text-sm text-gray-400">
          Escolha o período e clique em <strong className="text-white">Buscar no Mercado Pago</strong>.
          A página não consulta nada automaticamente.
        </div>
      ) : (
        <div className="space-y-5">
          {report.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm text-yellow-200">
              {report.warnings.map(warning => (
                <p key={warning} className="mb-1 last:mb-0">{warning}</p>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Compras"
              value={formatNumber(report.totals.purchases)}
              hint={formatMoney(report.totals.amount)}
            />
            <SummaryCard
              label="Compradores únicos"
              value={formatNumber(report.totals.buyers)}
              hint={`${formatNumber(report.totals.withEmail)} com e-mail`}
            />
            <SummaryCard
              label="Recorrentes (2+ compras)"
              value={formatNumber(report.totals.recurringBuyers)}
              hint="Lista ideal para Meta Ads"
            />
            <SummaryCard
              label="Com telefone"
              value={formatNumber(report.totals.withPhone)}
              hint={`MP cruzou ${formatNumber(report.mercadoPago.matchedLocal || 0)} de ${formatNumber(report.totals.purchases)} compras`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadCsv('recurring')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <FiDownload className="h-4 w-4" />
              CSV recorrentes (Meta)
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('buyers')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-primary-400"
            >
              <FiDownload className="h-4 w-4" />
              CSV todos compradores
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('purchases')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-primary-400"
            >
              <FiDownload className="h-4 w-4" />
              CSV todas as compras
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'recurring' as const, label: `Recorrentes (${report.totals.recurringBuyers})` },
              { key: 'buyers' as const, label: `Compradores (${report.totals.buyers})` },
              { key: 'purchases' as const, label: `Compras (${report.totals.purchases})` },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  tab === item.key
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-800 text-gray-300 hover:border-gray-600'
                }`}
              >
                <FiUsers className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/60">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  {tab === 'purchases' ? (
                    <>
                      <th className="px-3 py-3 font-semibold">Data</th>
                      <th className="px-3 py-3 font-semibold">Nome</th>
                      <th className="px-3 py-3 font-semibold">E-mail</th>
                      <th className="px-3 py-3 font-semibold">Telefone</th>
                      <th className="px-3 py-3 font-semibold">Valor</th>
                      <th className="px-3 py-3 font-semibold">Método</th>
                      <th className="px-3 py-3 font-semibold">Origem</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3 font-semibold">Nome</th>
                      <th className="px-3 py-3 font-semibold">E-mail</th>
                      <th className="px-3 py-3 font-semibold">Telefone</th>
                      <th className="px-3 py-3 font-semibold">Compras</th>
                      <th className="px-3 py-3 font-semibold">Total</th>
                      <th className="px-3 py-3 font-semibold">1ª compra</th>
                      <th className="px-3 py-3 font-semibold">Última</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-gray-500">
                      Nenhum registro neste filtro.
                    </td>
                  </tr>
                ) : tab === 'purchases' ? (
                  (tableRows as PurchaseRow[]).slice(0, 300).map(row => (
                    <tr key={`${row.paymentId}-${row.paidAt}`} className="border-b border-gray-900/80 text-gray-300">
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.paidAt)}</td>
                      <td className="px-3 py-3 font-medium text-white">{row.name || '—'}</td>
                      <td className="px-3 py-3">{row.email || '—'}</td>
                      <td className="px-3 py-3">{row.phone || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatMoney(row.amount)}</td>
                      <td className="px-3 py-3">{row.paymentMethod || '—'}</td>
                      <td className="px-3 py-3">{row.source}</td>
                    </tr>
                  ))
                ) : (
                  (tableRows as BuyerRow[]).slice(0, 300).map(row => (
                    <tr key={`${row.email}-${row.phone}-${row.name}`} className="border-b border-gray-900/80 text-gray-300">
                      <td className="px-3 py-3 font-medium text-white">{row.name || '—'}</td>
                      <td className="px-3 py-3">{row.email || '—'}</td>
                      <td className="px-3 py-3">{row.phone || '—'}</td>
                      <td className="px-3 py-3">
                        <span className={row.isRecurring ? 'font-bold text-emerald-300' : ''}>
                          {formatNumber(row.purchaseCount)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatMoney(row.totalAmount)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.firstPurchaseAt)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.lastPurchaseAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(tab === 'purchases' ? report.purchases.length : tab === 'buyers' ? report.buyers.length : report.recurringBuyers.length) > 300 && (
            <p className="text-xs text-gray-500">
              Mostrando os 300 primeiros na tela. O CSV exporta a lista completa.
            </p>
          )}

          <div className="rounded-2xl border border-gray-800 bg-black/20 p-4 text-sm text-gray-400">
            <p className="font-bold text-white">Como usar no Meta Ads</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Clique em <strong className="text-white">CSV recorrentes (Meta)</strong>.</li>
              <li>No Meta Ads Manager → Públicos → Criar público → Público personalizado → Arquivo de clientes.</li>
              <li>Faça upload do CSV (colunas: email, phone, fn, ln).</li>
              <li>Crie a campanha focada nesse público de quem comprou 2+ vezes.</li>
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
