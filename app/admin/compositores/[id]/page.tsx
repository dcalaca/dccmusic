'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiGift,
  FiKey,
  FiMail,
  FiMusic,
  FiRefreshCw,
  FiTrash2,
  FiUser,
  FiVideo,
  FiXCircle,
} from 'react-icons/fi'

interface Composer {
  id: string
  name: string
  slug: string
  email?: string
  emailVerified?: boolean
  hasActiveSubscription?: boolean
  subscriptionExpiresAt?: string | Date | null
  isPremium?: boolean
  createdAt: string | Date
  videoCount?: number
  musicCount?: number
  totalViews?: number
  studioLyricCount?: number
  studioMusicCount?: number
}

export default function AdminComposerProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const composerId = params.id
  const [composer, setComposer] = useState<Composer | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [crediting, setCrediting] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', slug: '', email: '' })
  const [creditForm, setCreditForm] = useState({
    musicQuantity: '2',
    reason: 'Correção de saldo do Studio IA',
    message: 'Identificamos o erro e creditamos músicas como compensação pelo transtorno.',
    sendEmail: true,
  })
  const [emailForm, setEmailForm] = useState({ email: '', subject: '', message: '' })

  useEffect(() => {
    loadComposer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerId])

  const loadComposer = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/composers/${composerId}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao carregar compositor')
      setComposer(data)
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const runComposerAction = async (action: string, successMessage: string) => {
    if (!composer) return
    try {
      setActionLoading(action)
      const response = await fetch(`/api/admin/composers/${composer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao executar ação')
      alert(successMessage)
      await loadComposer()
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleGrantAccess = async () => {
    if (!composer || !confirm(`Liberar acesso de graça por 10 anos para "${composer.name}"?`)) return
    try {
      setActionLoading('grant')
      const response = await fetch(`/api/admin/composers/${composer.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant', durationYears: 10 }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao liberar acesso')
      alert('Acesso liberado com sucesso.')
      await loadComposer()
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeAccess = async () => {
    if (!composer || !confirm(`Revogar acesso de "${composer.name}"?`)) return
    try {
      setActionLoading('revoke')
      const response = await fetch(`/api/admin/composers/${composer.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao revogar acesso')
      alert('Acesso revogado com sucesso.')
      await loadComposer()
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetPassword = async () => {
    if (!composer || !confirm(`Resetar a senha de "${composer.name}" para "123"?`)) return
    try {
      setActionLoading('reset')
      const response = await fetch(`/api/admin/composers/${composer.id}/reset-password`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao resetar senha')
      alert('Senha resetada com sucesso. A senha temporária é "123".')
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const openEdit = () => {
    if (!composer) return
    setEditForm({ name: composer.name, slug: composer.slug, email: composer.email || '' })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!composer) return
    try {
      setActionLoading('edit')
      const response = await fetch(`/api/admin/composers/${composer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim() || undefined,
          email: editForm.email.trim() || null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao salvar')
      alert('Compositor atualizado.')
      setEditing(false)
      await loadComposer()
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const saveCredit = async () => {
    if (!composer) return
    const musicQuantity = Math.floor(Number(creditForm.musicQuantity) || 0)
    if (musicQuantity <= 0) return alert('Informe a quantidade de músicas.')
    try {
      setActionLoading('credit')
      const response = await fetch(`/api/admin/composers/${composer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant_studio_credits',
          musicQuantity,
          reason: creditForm.reason.trim(),
          message: creditForm.message.trim(),
          sendEmail: creditForm.sendEmail,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao creditar')
      alert(`${musicQuantity} música(s) creditada(s). E-mail ${data.emailSent ? 'enviado' : 'não enviado'}.`)
      setCrediting(false)
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const openEmail = () => {
    if (!composer) return
    setEmailForm({ email: composer.email || '', subject: '', message: '' })
    setEmailing(true)
  }

  const sendEmail = async () => {
    if (!composer) return
    try {
      setActionLoading('email')
      const response = await fetch(`/api/admin/composers/${composer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_admin_email',
          email: emailForm.email.trim(),
          subject: emailForm.subject.trim(),
          message: emailForm.message.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao enviar e-mail')
      alert(`E-mail enviado para ${data.recipientEmail || emailForm.email}.`)
      setEmailing(false)
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!composer) return
    const confirmed = confirm(
      `Tem certeza que deseja excluir o compositor "${composer.name}"?\n\n` +
      'Esta ação apaga o cadastro, login, assinatura, pagamentos, projetos do Studio IA, letras e músicas IA deste usuário.\n\n' +
      'Esta ação não pode ser desfeita.'
    )
    if (!confirmed) return
    try {
      setActionLoading('delete')
      const response = await fetch(`/api/admin/composers/${composer.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.details || data.error || 'Erro ao excluir')
      alert('Compositor excluído.')
      router.push('/admin/compositores')
    } catch (error: any) {
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center py-8">
        <FiRefreshCw className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!composer) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <p className="text-gray-300">Compositor não encontrado.</p>
        </div>
      </div>
    )
  }

  const hasAccess = Boolean(composer.hasActiveSubscription && composer.isPremium)
  const isExpired = composer.subscriptionExpiresAt ? new Date(composer.subscriptionExpiresAt) < new Date() : false
  const isBusy = Boolean(actionLoading)

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link href="/admin/compositores" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar para compositores
        </Link>

        <div className="mb-6 rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-700">
                <FiUser className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">{composer.name}</h1>
                <p className="mt-1 text-gray-400">{composer.email || 'Sem e-mail'} · /{composer.slug}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {composer.emailVerified ? (
                    <span className="inline-flex items-center rounded-full border border-green-800 bg-green-900/40 px-3 py-1 text-xs font-bold text-green-300">
                      <FiCheckCircle className="mr-1 h-3 w-3" /> E-mail verificado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-yellow-800 bg-yellow-900/40 px-3 py-1 text-xs font-bold text-yellow-300">
                      <FiXCircle className="mr-1 h-3 w-3" /> Conta pendente
                    </span>
                  )}
                  {hasAccess && !isExpired ? (
                    <span className="inline-flex items-center rounded-full border border-green-800 bg-green-900/40 px-3 py-1 text-xs font-bold text-green-300">Plano ativo</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-red-800 bg-red-900/40 px-3 py-1 text-xs font-bold text-red-300">Plano inativo</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <Link href={`/compositores/${composer.slug}`} className="rounded-lg bg-gray-800 px-4 py-2 text-center text-sm font-bold text-white hover:bg-gray-700">
                Ver perfil público
              </Link>
              <Link href={`/admin/compositores/${composer.id}/studio`} className="rounded-lg bg-purple-700 px-4 py-2 text-center text-sm font-bold text-white hover:bg-purple-800">
                Studio IA
              </Link>
              <Link href={`/admin/compositores/${composer.id}/studio#extrato`} className="rounded-lg bg-purple-900 px-4 py-2 text-center text-sm font-bold text-purple-100 hover:bg-purple-800">
                Extrato
              </Link>
              <button onClick={openEdit} disabled={isBusy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                Editar
              </button>
              <Link href={`/admin/musicas/nova?composerId=${composer.id}`} className="rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-bold text-white hover:bg-emerald-800">
                Lançar música
              </Link>
              <Link href={`/admin/videos/novo?composerId=${composer.id}`} className="rounded-lg bg-red-700 px-4 py-2 text-center text-sm font-bold text-white hover:bg-red-800">
                Lançar vídeo
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Metric icon={<FiCalendar />} label="Cadastro" value={formatDate(composer.createdAt)} />
          <Metric icon={<FiVideo />} label="Vídeos" value={composer.videoCount ?? 0} />
          <Metric icon={<FiMusic />} label="Músicas" value={composer.musicCount ?? 0} />
          <Metric icon={<FiEye />} label="Visualizações" value={(composer.totalViews ?? 0).toLocaleString('pt-BR')} />
          <Metric icon={<FiEdit2 />} label="Letras Studio IA" value={composer.studioLyricCount ?? 0} />
          <Metric icon={<FiMusic />} label="Músicas Studio IA" value={composer.studioMusicCount ?? 0} />
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
          <h2 className="mb-4 text-xl font-black text-white">Ações administrativas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ActionButton icon={<FiGift />} label="Creditar músicas" color="emerald" disabled={isBusy} onClick={() => setCrediting(true)} />
            <ActionButton icon={<FiMail />} label="Enviar e-mail" color="sky" disabled={isBusy} onClick={openEmail} />
            <ActionButton icon={<FiKey />} label="Resetar senha para 123" color="yellow" disabled={isBusy} onClick={handleResetPassword} />
            {!composer.emailVerified && (
              <>
                <ActionButton icon={<FiCheckCircle />} label="Ativar conta" color="green" disabled={isBusy} onClick={() => runComposerAction('activate_account', 'Conta ativada. A senha padrão é 123.')} />
                <ActionButton icon={<FiMail />} label="Reenviar ativação" color="purple" disabled={isBusy} onClick={() => runComposerAction('send_activation_reminder', 'Lembrete de ativação enviado.')} />
              </>
            )}
            {hasAccess && !isExpired ? (
              <ActionButton icon={<FiXCircle />} label="Revogar acesso" color="red" disabled={isBusy} onClick={handleRevokeAccess} />
            ) : (
              <ActionButton icon={<FiCheckCircle />} label="Liberar acesso" color="green" disabled={isBusy} onClick={handleGrantAccess} />
            )}
            <ActionButton icon={<FiTrash2 />} label="Excluir compositor" color="red" disabled={isBusy} onClick={handleDelete} />
          </div>
          {composer.subscriptionExpiresAt && (
            <p className="mt-4 text-sm text-gray-400">Assinatura expira em: {formatDate(composer.subscriptionExpiresAt)}</p>
          )}
        </div>

        {editing && (
          <Modal title="Editar compositor" onClose={() => setEditing(false)}>
            <FormInput label="Nome" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} />
            <FormInput label="Slug" value={editForm.slug} onChange={(value) => setEditForm({ ...editForm, slug: value })} />
            <FormInput label="E-mail" value={editForm.email} onChange={(value) => setEditForm({ ...editForm, email: value })} />
            <ModalActions primary="Salvar" busy={actionLoading === 'edit'} onPrimary={saveEdit} onCancel={() => setEditing(false)} />
          </Modal>
        )}

        {crediting && (
          <Modal title="Creditar Studio IA" onClose={() => setCrediting(false)}>
            <FormInput label="Quantidade de músicas" type="number" value={creditForm.musicQuantity} onChange={(value) => setCreditForm({ ...creditForm, musicQuantity: value })} />
            <FormInput label="Motivo interno" value={creditForm.reason} onChange={(value) => setCreditForm({ ...creditForm, reason: value })} />
            <FormTextarea label="Mensagem para o compositor" value={creditForm.message} onChange={(value) => setCreditForm({ ...creditForm, message: value })} />
            <label className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-sm text-gray-200">
              <input type="checkbox" checked={creditForm.sendEmail} onChange={(event) => setCreditForm({ ...creditForm, sendEmail: event.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Enviar e-mail avisando o compositor
            </label>
            <ModalActions primary="Creditar" busy={actionLoading === 'credit'} onPrimary={saveCredit} onCancel={() => setCrediting(false)} />
          </Modal>
        )}

        {emailing && (
          <Modal title="Enviar e-mail" onClose={() => setEmailing(false)}>
            <FormInput label="E-mail do destinatário" value={emailForm.email} onChange={(value) => setEmailForm({ ...emailForm, email: value })} />
            <FormInput label="Assunto" value={emailForm.subject} onChange={(value) => setEmailForm({ ...emailForm, subject: value })} />
            <FormTextarea label="Mensagem" rows={8} value={emailForm.message} onChange={(value) => setEmailForm({ ...emailForm, message: value })} />
            <ModalActions primary="Enviar e-mail" busy={actionLoading === 'email'} onPrimary={sendEmail} onCancel={() => setEmailing(false)} />
          </Modal>
        )}
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-400">{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function ActionButton({ icon, label, color, disabled, onClick }: {
  icon: ReactNode
  label: string
  color: 'emerald' | 'sky' | 'yellow' | 'green' | 'purple' | 'red'
  disabled?: boolean
  onClick: () => void
}) {
  const classes: Record<typeof color, string> = {
    emerald: 'bg-emerald-700 hover:bg-emerald-800',
    sky: 'bg-sky-700 hover:bg-sky-800',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    green: 'bg-green-700 hover:bg-green-800',
    purple: 'bg-purple-700 hover:bg-purple-800',
    red: 'bg-red-700 hover:bg-red-800',
  }

  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[color]}`}>
      {icon}
      {label}
    </button>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700">Fechar</button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}

function FormInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-300">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-primary-500 focus:outline-none" />
    </label>
  )
}

function FormTextarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-300">{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-primary-500 focus:outline-none" />
    </label>
  )
}

function ModalActions({ primary, busy, onPrimary, onCancel }: { primary: string; busy?: boolean; onPrimary: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onPrimary} disabled={busy} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Processando...' : primary}
      </button>
      <button onClick={onCancel} disabled={busy} className="flex-1 rounded-lg bg-gray-800 px-4 py-2 font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
        Cancelar
      </button>
    </div>
  )
}
