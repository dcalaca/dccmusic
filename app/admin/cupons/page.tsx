'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiLoader, FiPlus, FiTag, FiTrash2 } from 'react-icons/fi'

type Coupon = {
  id: string
  code: string
  music_quantity: number
  price: number
  max_uses: number
  used_count: number
  expires_at: string | null
  active: boolean
  note: string | null
  created_at: string
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null) {
  if (!value) return 'Sem prazo'
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [code, setCode] = useState('')
  const [musicQuantity, setMusicQuantity] = useState('40')
  const [price, setPrice] = useState('50')
  const [maxUses, setMaxUses] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')

  const loadCoupons = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/cupons', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar cupons')
      setCoupons(data.coupons || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar cupons')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const response = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          musicQuantity: Number(musicQuantity),
          price: Number(price),
          maxUses: Number(maxUses),
          expiresAt: expiresAt || null,
          note,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao criar cupom')

      setSuccess(`Cupom "${data.coupon.code}" criado com sucesso!`)
      setCode('')
      setNote('')
      setExpiresAt('')
      await loadCoupons()
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cupom')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (coupon: Coupon) => {
    try {
      const response = await fetch('/api/admin/cupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, active: !coupon.active }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar cupom')
      await loadCoupons()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar cupom')
    }
  }

  const removeCoupon = async (coupon: Coupon) => {
    if (!confirm(`Excluir o cupom "${coupon.code}"? Essa ação não pode ser desfeita.`)) return
    try {
      const response = await fetch(`/api/admin/cupons?id=${coupon.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao excluir cupom')
      await loadCoupons()
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir cupom')
    }
  }

  const priceNumber = Number(price) || 0
  const quantityNumber = Number(musicQuantity) || 0
  const isFree = priceNumber <= 0

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
          <FiArrowLeft /> Voltar ao painel
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <FiTag className="h-8 w-8 text-purple-300" />
          <div>
            <h1 className="text-3xl font-black">Cupons do Studio IA</h1>
            <p className="text-sm text-gray-400">Crie cupons promocionais (pagos ou grátis) de músicas.</p>
          </div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}
        {success && <div className="mb-5 rounded-xl border border-green-800 bg-green-950/40 p-4 text-green-200">{success}</div>}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleCreate} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
            <h2 className="mb-4 text-xl font-bold">Criar novo cupom</h2>

            <label className="mb-1.5 block text-sm font-bold text-gray-200">Código do cupom</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: EMERSON50"
              className="mb-4 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 font-bold uppercase text-white outline-none focus:border-purple-400"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-200">Quantas músicas</label>
                <input
                  type="number"
                  min={1}
                  value={musicQuantity}
                  onChange={(e) => setMusicQuantity(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-200">Preço (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-purple-400"
                />
                <p className="mt-1 text-[11px] text-gray-500">Use 0 para cupom grátis.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-200">Limite total de usos</label>
                <input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-purple-400"
                />
                <p className="mt-1 text-[11px] text-gray-500">Cada compositor só usa uma vez. Aqui é o total da campanha.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-200">Validade (opcional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <label className="mb-1.5 mt-4 block text-sm font-bold text-gray-200">Observação (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Cliente antigo Emerson"
              className="mb-4 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-purple-400"
            />

            <div className="mb-4 rounded-xl border border-purple-800/60 bg-purple-950/30 p-4 text-sm text-purple-100">
              {isFree ? (
                <>Cupom <strong>GRÁTIS</strong>: o cliente ganha <strong>{quantityNumber} música(s)</strong> sem pagar nada. Cada compositor só consegue usar uma vez.</>
              ) : (
                <>Cupom <strong>PAGO</strong>: o cliente paga <strong>{formatMoney(priceNumber)}</strong> e recebe <strong>{quantityNumber} música(s)</strong>{quantityNumber > 0 ? ` (${formatMoney(priceNumber / quantityNumber)} por música)` : ''}. Cada compositor só consegue usar uma vez.</>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500 disabled:opacity-60"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiPlus />}
              Criar cupom
            </button>
          </form>

          <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
            <h2 className="mb-4 text-xl font-bold">Cupons criados</h2>
            {loading ? (
              <div className="flex justify-center py-10">
                <FiLoader className="h-8 w-8 animate-spin text-primary-300" />
              </div>
            ) : coupons.length === 0 ? (
              <p className="py-8 text-center text-gray-500">Nenhum cupom criado ainda.</p>
            ) : (
              <div className="space-y-3">
                {coupons.map((coupon) => {
                  const exhausted = coupon.used_count >= coupon.max_uses
                  const expired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false
                  return (
                    <div key={coupon.id} className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-purple-900/60 px-3 py-1 font-black tracking-wide text-purple-100">{coupon.code}</span>
                          {coupon.price <= 0 ? (
                            <span className="rounded-md bg-green-900/50 px-2 py-0.5 text-xs font-bold text-green-200">GRÁTIS</span>
                          ) : (
                            <span className="rounded-md bg-blue-900/50 px-2 py-0.5 text-xs font-bold text-blue-200">{formatMoney(coupon.price)}</span>
                          )}
                          {!coupon.active && <span className="rounded-md bg-gray-700 px-2 py-0.5 text-xs font-bold text-gray-200">INATIVO</span>}
                          {expired && <span className="rounded-md bg-red-900/50 px-2 py-0.5 text-xs font-bold text-red-200">EXPIRADO</span>}
                          {exhausted && <span className="rounded-md bg-orange-900/50 px-2 py-0.5 text-xs font-bold text-orange-200">ESGOTADO</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleActive(coupon)}
                            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-200 hover:border-purple-400"
                          >
                            {coupon.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => removeCoupon(coupon)}
                            className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-950/50"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-300 sm:grid-cols-4">
                        <p><span className="text-gray-500">Músicas:</span> {coupon.music_quantity}</p>
                        <p><span className="text-gray-500">Usos:</span> {coupon.used_count}/{coupon.max_uses}</p>
                        <p><span className="text-gray-500">Validade:</span> {formatDate(coupon.expires_at)}</p>
                        <p className="truncate"><span className="text-gray-500">Obs:</span> {coupon.note || '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
