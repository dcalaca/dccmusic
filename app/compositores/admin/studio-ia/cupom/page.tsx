'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiArrowRight, FiCheck, FiGift, FiLoader, FiSearch } from 'react-icons/fi'

type CouponPreview = {
  code: string
  type: 'free' | 'paid'
  musicQuantity: number
  credits: number
  price: number
  unitPrice: number
  expiresAt: string | null
  alreadyRedeemed: boolean
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function StudioCouponPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<CouponPreview | null>(null)
  const [freeSuccess, setFreeSuccess] = useState<{ musicQuantity: number } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/cupom')
      return
    }
    setCheckingAuth(false)
  }, [router])

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/cupom')
      return
    }
    if (code.trim().length < 3) {
      setError('Digite o código do cupom.')
      return
    }

    try {
      setChecking(true)
      const response = await fetch('/api/compositores/studio/cupom/validate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Cupom inválido')
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao verificar cupom')
    } finally {
      setChecking(false)
    }
  }

  const handleConfirm = async () => {
    setError('')
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/cupom')
      return
    }

    try {
      setConfirming(true)
      const response = await fetch('/api/compositores/studio/cupom/redeem', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: (preview?.code || code).trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao aplicar cupom')

      if (data.type === 'free') {
        setFreeSuccess({ musicQuantity: data.musicQuantity })
        return
      }

      const checkoutUrl = data.initPoint || data.sandboxInitPoint
      if (!checkoutUrl) throw new Error('Não foi possível abrir o pagamento.')
      window.location.href = checkoutUrl
    } catch (err: any) {
      setError(err.message || 'Erro ao aplicar cupom')
      setConfirming(false)
    }
  }

  const resetPreview = () => {
    setPreview(null)
    setError('')
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-12 w-12 animate-spin text-primary-300" />
      </div>
    )
  }

  if (freeSuccess) {
    return (
      <div className="min-h-screen py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-xl rounded-3xl border border-green-700/60 bg-gradient-to-br from-green-950/40 via-black to-gray-950 p-8 text-center">
            <FiCheck className="mx-auto mb-4 h-14 w-14 text-green-300" />
            <h1 className="mb-2 text-3xl font-black">Cupom aplicado!</h1>
            <p className="mb-6 text-gray-300">
              Você ganhou <strong className="text-green-300">{freeSuccess.musicQuantity} música(s)</strong>. Já estão disponíveis no seu saldo.
            </p>
            <Link
              href="/compositores/admin/studio-ia/novo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
            >
              Criar música agora
            </Link>
            <Link
              href="/compositores/admin/studio-ia"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-gray-700 px-6 py-3 font-semibold text-gray-200 hover:bg-gray-900/50"
            >
              Voltar ao Studio IA
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-xl">
          <Link href="/compositores/admin/studio-ia" className="mb-8 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar ao Studio IA
          </Link>

          <div className="rounded-3xl border border-purple-700/60 bg-gradient-to-br from-purple-950/40 via-black to-gray-950 p-8">
            <div className="mb-6 flex items-center gap-3">
              <FiGift className="h-9 w-9 text-purple-300" />
              <div>
                <h1 className="text-3xl font-black">Tenho um cupom</h1>
                <p className="text-sm text-gray-400">Digite o código que você recebeu.</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>
            )}

            {!preview ? (
              <form onSubmit={handleCheck}>
                <label className="mb-2 block text-sm font-bold text-gray-200">Código do cupom</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: EMERSON50"
                  className="mb-5 w-full rounded-2xl border border-purple-700/70 bg-black px-5 py-4 text-2xl font-black uppercase tracking-wider text-white outline-none focus:border-purple-300"
                />

                <button
                  type="submit"
                  disabled={checking}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4 font-bold text-white hover:from-primary-500 hover:to-purple-500 disabled:opacity-60"
                >
                  {checking ? <FiLoader className="animate-spin" /> : <FiSearch />}
                  Verificar cupom
                </button>
              </form>
            ) : (
              <div>
                <div className="mb-5 rounded-2xl border border-green-600/50 bg-green-950/30 p-5 text-center">
                  <p className="text-lg font-black text-green-300">🎉 Uau, esse cupom está ativo!</p>
                  <p className="mt-1 text-sm text-gray-300">Veja o que você vai receber:</p>
                </div>

                <div className="mb-5 space-y-3 rounded-2xl border border-gray-800 bg-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Código</span>
                    <span className="font-black tracking-wide text-purple-200">{preview.code}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Músicas</span>
                    <span className="text-xl font-black text-white">{preview.musicQuantity}</span>
                  </div>
                  {preview.type === 'paid' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Valor a pagar</span>
                        <span className="text-xl font-black text-green-300">{formatMoney(preview.price)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Preço por música</span>
                        <span className="text-gray-300">{formatMoney(preview.unitPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Valor</span>
                      <span className="rounded-md bg-green-900/50 px-3 py-1 text-sm font-black text-green-200">GRÁTIS</span>
                    </div>
                  )}
                  {formatDate(preview.expiresAt) && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Válido até</span>
                      <span className="text-gray-300">{formatDate(preview.expiresAt)}</span>
                    </div>
                  )}
                </div>

                {preview.alreadyRedeemed ? (
                  <div className="mb-5 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4 text-sm text-amber-200">
                    Você já resgatou este cupom grátis antes. Ele só pode ser usado uma vez por pessoa.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming || preview.alreadyRedeemed}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4 font-bold text-white hover:from-primary-500 hover:to-purple-500 disabled:opacity-60"
                >
                  {confirming ? (
                    <FiLoader className="animate-spin" />
                  ) : (
                    <>
                      {preview.type === 'paid' ? 'Continuar para o pagamento' : 'Resgatar agora'}
                      <FiArrowRight />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetPreview}
                  disabled={confirming}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-gray-700 px-6 py-3 font-semibold text-gray-300 hover:bg-gray-900/50 disabled:opacity-60"
                >
                  Usar outro código
                </button>

                {preview.type === 'paid' && (
                  <p className="mt-4 text-center text-xs text-gray-500">
                    Você será levado ao Mercado Pago para pagar {formatMoney(preview.price)}. As músicas entram automaticamente após o pagamento.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
