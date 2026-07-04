'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiBarChart2, FiCopy, FiMail, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'

type Partner = {
  id: string
  email?: string | null
  displayName: string
  partnerCode: string
  commissionPercentage: number
  commissionModel: 'percentage' | 'cpa'
  commissionPaymentScope: 'lifetime' | 'first_purchase'
  cpaStudioTopupAmount: number
  cpaSubscriptionAmount: number
  commissionCapAmount?: number | null
  attributionWindowDays: number
  customerLifetimeMonths: number
  requiresPasswordChange: boolean
  isActive: boolean
  link: string
  trackedLink: string
  createdAt: string
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [resendingId, setResendingId] = useState('')
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    commissionModel: 'percentage' as 'percentage' | 'cpa',
    commissionPaymentScope: 'lifetime' as 'lifetime' | 'first_purchase',
    commissionPercentage: '10',
    cpaStudioTopupAmount: '25',
    cpaSubscriptionAmount: '35',
    commissionCapAmount: '3000',
    attributionWindowDays: '15',
    customerLifetimeMonths: '6',
  })

  const loadPartners = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/partners', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar parceiros')
      setPartners(data.partners || [])
      setSetupRequired(Boolean(data.setupRequired))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar parceiros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const createPartner = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const response = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          displayName: form.displayName,
          commissionModel: form.commissionModel,
          commissionPaymentScope: form.commissionPaymentScope,
          commissionPercentage: Number(form.commissionPercentage) || 10,
          cpaStudioTopupAmount: Number(form.cpaStudioTopupAmount) || 0,
          cpaSubscriptionAmount: Number(form.cpaSubscriptionAmount) || 0,
          commissionCapAmount: form.commissionCapAmount.trim() ? Number(form.commissionCapAmount) || 0 : null,
          attributionWindowDays: Number(form.attributionWindowDays) || 15,
          customerLifetimeMonths: Number(form.customerLifetimeMonths) || 6,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao criar parceiro')
      setSuccess(data.welcomeEmailSent
        ? 'Parceiro criado e e-mail de boas-vindas enviado.'
        : 'Parceiro criado. O e-mail não foi enviado automaticamente; confira a configuração do Resend.')
      setForm({
        email: '',
        displayName: '',
        commissionModel: 'percentage',
        commissionPaymentScope: 'lifetime',
        commissionPercentage: '10',
        cpaStudioTopupAmount: '25',
        cpaSubscriptionAmount: '35',
        commissionCapAmount: '3000',
        attributionWindowDays: '15',
        customerLifetimeMonths: '6',
      })
      await loadPartners()
    } catch (err: any) {
      setError(err.message || 'Erro ao criar parceiro')
    } finally {
      setSaving(false)
    }
  }

  const deletePartner = async (partner: Partner) => {
    const confirmed = window.confirm(
      `Excluir o parceiro "${partner.displayName}"?\n\n` +
      'O link de afiliado dele deixa de atribuir vendas. Os cadastros e comissões antigos não são apagados, apenas desvinculados. ' +
      'Você pode cadastrar esse parceiro de novo depois, se precisar.'
    )
    if (!confirmed) return

    try {
      setDeletingId(partner.id)
      setError('')
      setSuccess('')
      const response = await fetch(`/api/admin/partners?id=${partner.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao excluir parceiro')
      setSuccess(`Parceiro "${partner.displayName}" excluído. O e-mail dele já pode ser usado em um novo cadastro.`)
      await loadPartners()
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir parceiro')
    } finally {
      setDeletingId('')
    }
  }

  const resendPartnerEmail = async (partner: Partner) => {
    try {
      setResendingId(partner.id)
      setError('')
      setSuccess('')
      const response = await fetch(`/api/admin/partners/${partner.id}/resend-email`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar e-mail')
      setSuccess(`E-mail reenviado para ${partner.email || partner.displayName}.`)
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar e-mail')
    } finally {
      setResendingId('')
    }
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              <span className="gradient-text">Parceiros / Afiliados</span>
            </h1>
            <p className="mt-2 text-gray-400">
              Crie parceiros, gere links e acompanhe atribuição por first click.
            </p>
            <p className="mt-1 text-sm text-cyan-200">
              Login do parceiro:{' '}
              <Link href="/parceiros/login" target="_blank" className="font-bold underline underline-offset-4">
                /parceiros/login
              </Link>{' '}
              · senha inicial: 123
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/admin/parceiros/funil"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
            >
              <FiBarChart2 />
              Ver funil
            </Link>
            <button
              type="button"
              onClick={loadPartners}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-primary-500"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {setupRequired && (
          <div className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-950/30 p-5 text-yellow-100">
            Rode o arquivo <strong>SQL-SISTEMA-PARCEIROS-AFILIADOS.sql</strong> no Supabase antes de criar parceiros.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-800 bg-green-950/40 p-4 text-green-200">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={createPartner} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-primary-600 p-3 text-white">
                <FiPlus />
              </div>
              <div>
                <h2 className="text-xl font-black">Novo parceiro</h2>
                <p className="text-sm text-gray-400">Crie uma conta própria para empresa, influencer ou parceiro.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-300">E-mail de acesso do parceiro</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                  placeholder="parceiro@email.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-300">Nome público do parceiro</label>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                  placeholder="João Divulgação"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-300">Modelo de comissão</label>
                <select
                  value={form.commissionModel}
                  onChange={(event) => {
                    const commissionModel = event.target.value as 'percentage' | 'cpa'
                    setForm({
                      ...form,
                      commissionModel,
                      commissionPaymentScope: commissionModel === 'cpa' ? 'first_purchase' : form.commissionPaymentScope,
                    })
                  }}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                >
                  <option value="percentage">Percentual sobre venda</option>
                  <option value="cpa">CPA por produto com teto</option>
                </select>
              </div>

              {form.commissionModel === 'percentage' ? (
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-300">Comissão %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.commissionPercentage}
                    onChange={(event) => setForm({ ...form, commissionPercentage: event.target.value })}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-purple-900/60 bg-purple-950/20 p-4">
                  <p className="mb-3 text-sm font-bold text-purple-100">CPA por produto</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-300">Música avulsa</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.cpaStudioTopupAmount}
                        onChange={(event) => setForm({ ...form, cpaStudioTopupAmount: event.target.value })}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-300">Assinatura</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.cpaSubscriptionAmount}
                        onChange={(event) => setForm({ ...form, cpaSubscriptionAmount: event.target.value })}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-300">Teto total</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.commissionCapAmount}
                        onChange={(event) => setForm({ ...form, commissionCapAmount: event.target.value })}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-purple-200">
                    Exemplo deste acordo: R$ 25 por música avulsa, R$ 35 por assinatura, limitado a R$ 3.000.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-300">Regra de pagamento</label>
                <select
                  value={form.commissionPaymentScope}
                  onChange={(event) => setForm({ ...form, commissionPaymentScope: event.target.value as 'lifetime' | 'first_purchase' })}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                >
                  <option value="lifetime">Pagar compras dentro do LT</option>
                  <option value="first_purchase">Pagar somente a primeira compra do cliente</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Para esse parceiro, use “Pagar somente a primeira compra do cliente”.
                </p>
              </div>

              <div className={`grid gap-3 ${form.commissionPaymentScope === 'first_purchase' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-300">Janela dias</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={form.attributionWindowDays}
                    onChange={(event) => setForm({ ...form, attributionWindowDays: event.target.value })}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                  />
                </div>
                {form.commissionPaymentScope !== 'first_purchase' && (
                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-300">LT meses</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={form.customerLifetimeMonths}
                      onChange={(event) => setForm({ ...form, customerLifetimeMonths: event.target.value })}
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {form.commissionPaymentScope === 'first_purchase'
                  ? 'A janela define por quantos dias o cadastro vindo do link pode gerar a primeira comissão. Compras seguintes do mesmo cliente não pagam comissão.'
                  : 'LT padrão: 6 meses. Dentro desse período, toda compra do cliente atribuído gera comissão para o parceiro.'}
              </p>

              <button
                type="submit"
                disabled={saving || setupRequired}
                className="w-full rounded-xl bg-primary-600 px-4 py-3 font-black text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Criando...' : 'Criar parceiro'}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-5 text-xl font-black">Parceiros cadastrados</h2>
            {loading ? (
              <p className="text-gray-400">Carregando...</p>
            ) : partners.length === 0 ? (
              <p className="text-gray-400">Nenhum parceiro cadastrado ainda.</p>
            ) : (
              <div className="space-y-4">
                {partners.map((partner) => (
                  <div key={partner.id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-white">{partner.displayName}</h3>
                        {partner.email && <p className="text-sm text-gray-400">Login: {partner.email}</p>}
                        <p className="text-sm text-gray-400">
                          Código: <span className="font-mono text-cyan-200">{partner.partnerCode}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {partner.commissionModel === 'cpa'
                            ? `CPA: R$ ${partner.cpaStudioTopupAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} avulsa · R$ ${partner.cpaSubscriptionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} assinatura · teto ${partner.commissionCapAmount ? `R$ ${partner.commissionCapAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'sem teto'}`
                            : `Comissão ${partner.commissionPercentage}%`}
                          {' '}· {partner.commissionPaymentScope === 'first_purchase' ? 'só 1ª compra' : 'compras no LT'}
                          {' '}· janela {partner.attributionWindowDays} dias · LT {partner.customerLifetimeMonths} meses
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          partner.requiresPasswordChange
                            ? 'bg-yellow-950 text-yellow-200'
                            : partner.isActive
                              ? 'bg-green-950 text-green-200'
                              : 'bg-red-950 text-red-200'
                        }`}>
                          {partner.requiresPasswordChange ? 'Pendente' : partner.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <button
                          type="button"
                          onClick={() => resendPartnerEmail(partner)}
                          disabled={resendingId === partner.id || !partner.email}
                          title="Reenviar e-mail de acesso"
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-800 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-60"
                        >
                          <FiMail />
                          {resendingId === partner.id ? 'Reenviando...' : 'Reenviar e-mail'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePartner(partner)}
                          disabled={deletingId === partner.id}
                          title="Excluir parceiro"
                          className="inline-flex items-center gap-1 rounded-lg border border-red-800 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-950/50 disabled:opacity-60"
                        >
                          <FiTrash2 />
                          {deletingId === partner.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                        <input readOnly value={partner.link} className="min-w-0 flex-1 bg-transparent text-xs text-gray-300 outline-none" />
                        <button type="button" onClick={() => copy(partner.link)} className="text-cyan-200 hover:text-cyan-100">
                          <FiCopy />
                        </button>
                      </div>
                      <p className="text-xs text-yellow-200">
                        {partner.requiresPasswordChange
                          ? <>Pendente: o parceiro ainda precisa entrar com a senha temporária <strong>123</strong> e criar a senha oficial.</>
                          : 'Parceiro já criou a senha oficial.'}
                      </p>
                      {copied === partner.link && <p className="text-xs text-green-300">Link copiado.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

