'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FiCheck, FiCopy, FiCreditCard, FiLoader, FiX } from 'react-icons/fi'

type Props = {
  amount: number
  email?: string | null
  onClose: () => void
  onPaid: (result: any) => void
  onSubmit: (payload: any) => Promise<any>
  onCheckStatus: (paymentId: string) => Promise<any>
}

const digits = (value: string) => value.replace(/\D/g, '')

export function AsaasPaymentOverlay({ amount, email, onClose, onPaid, onSubmit, onCheckStatus }: Props) {
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pix, setPix] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', email: email || '', cpfCnpj: '', holderName: '', number: '', expiry: '', ccv: '', postalCode: '', addressNumber: '', mobilePhone: '' })

  useEffect(() => {
    if (!pix?.paymentId) return
    let cancelled = false
    let checking = false
    const check = async () => {
      if (cancelled || checking) return
      checking = true
      try {
        const result = await onCheckStatus(pix.paymentId)
        if (!cancelled && result?.status === 'paid') onPaid(result)
      } catch {
        // O webhook e a próxima consulta continuam como caminhos de confirmação.
      } finally {
        checking = false
      }
    }
    const interval = window.setInterval(check, 3000)
    void check()
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [pix?.paymentId, onCheckStatus, onPaid])

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const [expiryMonth = '', expiryYear = ''] = form.expiry.split('/')
      const result = await onSubmit({
        method,
        customer: { name: form.name, email: form.email, cpfCnpj: form.cpfCnpj },
        ...(method === 'card' ? {
          card: { holderName: form.holderName || form.name, number: form.number, expiryMonth, expiryYear, ccv: form.ccv },
          holder: { postalCode: form.postalCode, addressNumber: form.addressNumber, mobilePhone: form.mobilePhone },
        } : {}),
      })
      if (result.status === 'paid') return onPaid(result)
      if (result.pix) setPix({ ...result.pix, paymentId: result.paymentId })
      else setError('Pagamento em análise. A liberação será automática após a confirmação.')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível processar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-cyan-400'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-700 bg-gray-950 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between">
          <div><p className="text-xs uppercase tracking-wider text-cyan-300">Pagamento seguro</p><h2 className="text-2xl font-black text-white">Recarga {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fechar pagamento" className="rounded-full p-2 text-gray-400 hover:bg-gray-800 hover:text-white"><FiX size={22} /></button>
        </div>

        {!pix ? <>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-black p-1">
            <button type="button" onClick={() => setMethod('pix')} className={`rounded-lg py-3 font-bold ${method === 'pix' ? 'bg-cyan-500 text-black' : 'text-gray-300'}`}>Pix</button>
            <button type="button" onClick={() => setMethod('card')} className={`rounded-lg py-3 font-bold ${method === 'card' ? 'bg-cyan-500 text-black' : 'text-gray-300'}`}>Cartão</button>
          </div>
          <div className="mt-5 space-y-3">
            <input aria-label="Nome completo" className={inputClass} placeholder="Nome completo" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            <input aria-label="CPF ou CNPJ" className={inputClass} placeholder="CPF ou CNPJ" inputMode="numeric" value={form.cpfCnpj} onChange={(e) => set('cpfCnpj', digits(e.target.value).slice(0, 14))} />
            <input aria-label="E-mail" className={inputClass} placeholder="E-mail" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {method === 'card' ? <>
              <input className={inputClass} placeholder="Nome impresso no cartão" autoComplete="cc-name" value={form.holderName} onChange={(e) => set('holderName', e.target.value)} />
              <input className={inputClass} placeholder="Número do cartão" inputMode="numeric" autoComplete="cc-number" value={form.number} onChange={(e) => set('number', digits(e.target.value).slice(0, 19))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" value={form.expiry} onChange={(e) => { const value = digits(e.target.value).slice(0, 4); set('expiry', value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value) }} />
                <input className={inputClass} placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" value={form.ccv} onChange={(e) => set('ccv', digits(e.target.value).slice(0, 4))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="CEP" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={(e) => set('postalCode', digits(e.target.value).slice(0, 8))} />
                <input className={inputClass} placeholder="Número" inputMode="numeric" value={form.addressNumber} onChange={(e) => set('addressNumber', e.target.value.slice(0, 20))} />
              </div>
              <input className={inputClass} placeholder="Celular (opcional)" inputMode="tel" autoComplete="tel" value={form.mobilePhone} onChange={(e) => set('mobilePhone', digits(e.target.value).slice(0, 11))} />
            </> : <p className="text-sm text-gray-400">O QR Code e o Pix copia e cola aparecerão aqui, sem sair do DCC.</p>}
          </div>
          {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p> : null}
          <button type="button" onClick={submit} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-4 font-black text-black hover:bg-cyan-300 disabled:opacity-60">
            {loading ? <FiLoader className="animate-spin" /> : <FiCreditCard />} {method === 'pix' ? 'Gerar Pix' : 'Pagar com cartão'}
          </button>
          <p className="mt-3 text-center text-xs text-gray-500">Os dados do cartão não são armazenados pelo DCC Music.</p>
        </> : <div className="mt-6 text-center">
          <div className="mx-auto w-fit rounded-2xl bg-white p-3"><Image unoptimized width={224} height={224} src={`data:image/png;base64,${pix.encodedImage}`} alt="QR Code Pix" className="h-56 w-56" /></div>
          <p className="mt-4 font-bold text-white">Escaneie o QR Code ou copie o código Pix</p>
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(pix.payload); setCopied(true) }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500 px-4 py-3 font-bold text-cyan-300">
            {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Código copiado' : 'Copiar código Pix'}
          </button>
          <p className="mt-4 text-sm text-gray-400">Após pagar, os créditos serão liberados automaticamente.</p>
        </div>}
      </div>
    </div>
  )
}
